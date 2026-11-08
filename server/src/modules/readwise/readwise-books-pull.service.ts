import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import type { ReadStatus } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { BookService } from '../book/book.service';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { UserBookStatusService } from '../user-book-status/user-book-status.service';
import { mergeField } from '../reading-services/three-way-merge';
import type { ReadwiseBook } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseBooksLocalBooksRepository } from './readwise-books-local-books.repository';
import { mapReadwiseStatusToBookOrbit } from './readwise-books-status-mapping';
import {
  READWISE_BOOKS_FULL_PASS_INTERVAL_MS,
  READWISE_BOOKS_LIST_LIMIT,
  READWISE_BOOKS_PULL_CURSOR_CACHE_KEY,
  READWISE_BOOKS_PULL_CURSOR_TTL_MS,
  READWISE_BOOKS_PULL_INTERVAL_MS,
  READWISE_BOOKS_PULL_USER_CONCURRENCY,
} from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

const EVENT = 'readwise.books_pull';

interface PullCursor {
  updatedAfter: string | null;
  lastFullPassAt: string | null;
}

type BookSnapshot = { status?: string; rating?: number | null; startedAt?: string | null; finishedAt?: string | null };

function roundReadwiseRating(rating: number | null): number | null {
  // Readwise ratings step by 0.25; BookOrbit's are integers. Half rounds up (section 4.2).
  return rating === null ? null : Math.round(rating);
}

/**
 * Interval pull for Readwise Books: status, rating and dates on already-linked books.
 * Incremental passes use `updated_after`; a full re-list runs every 6 hours because rating and
 * review changes don't bump Readwise's `updated` field (readwise-api.md §3). Every pull write
 * updates the link snapshot before calling the local service that applies it, which is what
 * stops the resulting `book.status-changed`/`book.rating-changed` event from being pushed back.
 */
@Injectable()
export class ReadwiseBooksPullService {
  private readonly logger = new Logger(ReadwiseBooksPullService.name);

  constructor(
    private readonly client: ReadwiseBooksClientService,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly readwiseSettings: ReadwiseSettingsService,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly featuresService: ReadingServiceFeaturesService,
    private readonly cache: ReadingServiceCacheService,
    private readonly localBooks: ReadwiseBooksLocalBooksRepository,
    private readonly userBookStatusService: UserBookStatusService,
    private readonly bookService: BookService,
  ) {}

  @Interval(READWISE_BOOKS_PULL_INTERVAL_MS)
  async pullAllConnectedUsers(): Promise<void> {
    const userIds = await this.readwiseRepo.findConnectedUserIds();
    for (let i = 0; i < userIds.length; i += READWISE_BOOKS_PULL_USER_CONCURRENCY) {
      const batch = userIds.slice(i, i + READWISE_BOOKS_PULL_USER_CONCURRENCY);
      await Promise.all(batch.map((userId) => this.pullForUser(userId).catch((err) => this.logFailure(userId, err))));
    }
  }

  async pullForUser(userId: number): Promise<void> {
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return;

    const cursor = (await this.cache.get<PullCursor>(userId, 'readwise', READWISE_BOOKS_PULL_CURSOR_CACHE_KEY)) ?? {
      updatedAfter: null,
      lastFullPassAt: null,
    };
    const dueForFullPass = !cursor.lastFullPassAt || Date.now() - new Date(cursor.lastFullPassAt).getTime() >= READWISE_BOOKS_FULL_PASS_INTERVAL_MS;
    const startedAt = Date.now();
    const nowIso = new Date().toISOString();

    try {
      const applied = dueForFullPass ? await this.runFullPass(userId, token) : await this.runIncrementalPass(userId, token, cursor.updatedAfter);

      const next: PullCursor = { updatedAfter: nowIso, lastFullPassAt: dueForFullPass ? nowIso : cursor.lastFullPassAt };
      await this.cache.set(userId, 'readwise', READWISE_BOOKS_PULL_CURSOR_CACHE_KEY, next, READWISE_BOOKS_PULL_CURSOR_TTL_MS);

      this.logger.log(
        `[${EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAt} fullPass=${dueForFullPass} applied=${applied} - books pull completed`,
      );
    } catch (err) {
      if (err instanceof ReadwiseBooksForbiddenError) {
        await this.readwiseRepo.upsertSettings(userId, { disabledReason: 'no_readwise_books', enabled: false });
        return;
      }
      throw err;
    }
  }

  /** Incremental: only books Readwise reports as updated since the cursor. */
  private async runIncrementalPass(userId: number, token: string, updatedAfter: string | null): Promise<number> {
    let applied = 0;
    let cursor: string | undefined;
    for (;;) {
      const page = await this.client.listBooks(userId, token, {
        order: 'updated',
        updatedAfter: updatedAfter ?? undefined,
        limit: READWISE_BOOKS_LIST_LIMIT,
        cursor,
      });
      for (const book of page.results) {
        if (await this.applyRemoteBook(userId, book)) applied += 1;
      }
      if (!page.next) break;
      cursor = page.next;
    }
    return applied;
  }

  /**
   * Full re-list, needed because rating/review changes don't bump `updated`. Also diffs the
   * full remote id set against linked books to catch hard deletes (Kindle/Goodreads purges),
   * which disappear from every list rather than reporting `status: "deleted"`.
   */
  private async runFullPass(userId: number, token: string): Promise<number> {
    let applied = 0;
    let cursor: string | undefined;
    const seenExternalIds = new Set<string>();
    for (;;) {
      const page = await this.client.listBooks(userId, token, { limit: READWISE_BOOKS_LIST_LIMIT, cursor });
      for (const book of page.results) {
        seenExternalIds.add(book.id);
        if (await this.applyRemoteBook(userId, book)) applied += 1;
      }
      if (!page.next) break;
      cursor = page.next;
    }

    const links = await this.readingServicesRepo.findBookLinksForProvider(userId, 'readwise');
    for (const link of links) {
      if (!link.remoteDeleted && !seenExternalIds.has(link.externalBookId)) {
        await this.readingServicesRepo.markRemoteDeleted(userId, 'readwise', link.bookId);
      }
    }
    return applied;
  }

  /** Applies one remote book to its linked local book, if any. Returns whether anything changed. */
  private async applyRemoteBook(userId: number, book: ReadwiseBook): Promise<boolean> {
    const link = await this.readingServicesRepo.findBookLinkByExternalId(userId, 'readwise', book.id);
    if (!link) return false; // not yet linked; S3 only syncs already-migrated books

    if (book.status === 'deleted') {
      if (!link.remoteDeleted) await this.readingServicesRepo.markRemoteDeleted(userId, 'readwise', link.bookId);
      return false;
    }

    const local = await this.localBooks.findOne(userId, link.bookId);
    if (!local) return false;

    const features = await this.featuresService.getFeatures(userId, 'readwise');
    const snapshot: BookSnapshot = (link.snapshot as BookSnapshot) ?? {};
    const nextSnapshot: BookSnapshot = { ...snapshot };

    let newStatus: ReadStatus | undefined;
    let newRating: number | null | undefined;
    let newStartedAt: string | null | undefined;
    let newFinishedAt: string | null | undefined;

    if (features.status !== false) {
      const action = mergeField(local.status, mapReadwiseStatusToBookOrbit(book.status, local.status) ?? local.status, snapshot.status as ReadStatus);
      if (action.action === 'pull') {
        const mapped = mapReadwiseStatusToBookOrbit(book.status, local.status);
        if (mapped && mapped !== local.status) {
          newStatus = mapped;
          nextSnapshot.status = mapped;
        }
      }
    }

    if (features.rating !== false) {
      const remoteRating = roundReadwiseRating(book.rating);
      const action = mergeField(local.rating, remoteRating, snapshot.rating === undefined ? undefined : (snapshot.rating ?? null));
      if (action.action === 'pull' && remoteRating !== local.rating) {
        newRating = remoteRating;
        nextSnapshot.rating = remoteRating;
      }
    }

    if (features.dates !== false) {
      const startedAction = this.mergeDateField(local.startedAt, book.started_reading_at ?? null, snapshot.startedAt);
      if (startedAction.action === 'pull' && startedAction.value !== local.startedAt) {
        newStartedAt = startedAction.value;
        nextSnapshot.startedAt = startedAction.value;
      }
      const finishedAction = this.mergeDateField(local.finishedAt, book.finished_reading_at ?? null, snapshot.finishedAt);
      if (finishedAction.action === 'pull' && finishedAction.value !== local.finishedAt) {
        newFinishedAt = finishedAction.value;
        nextSnapshot.finishedAt = finishedAction.value;
      }
    }

    if (newStatus === undefined && newRating === undefined && newStartedAt === undefined && newFinishedAt === undefined) {
      return false;
    }

    // Write the snapshot before applying locally: the status/rating services below emit the
    // same achievement events the push listener watches, and this is what stops that push.
    await this.readingServicesRepo.upsertBookLink(userId, 'readwise', link.bookId, {
      externalBookId: link.externalBookId,
      matchMethod: link.matchMethod,
      snapshot: nextSnapshot,
    });

    if (newStatus !== undefined || newStartedAt !== undefined || newFinishedAt !== undefined) {
      await this.userBookStatusService.updateManual(userId, link.bookId, {
        ...(newStatus !== undefined ? { status: newStatus } : {}),
        ...(newStartedAt !== undefined ? { startedAt: newStartedAt ? new Date(newStartedAt) : null } : {}),
        ...(newFinishedAt !== undefined ? { finishedAt: newFinishedAt ? new Date(newFinishedAt) : null } : {}),
      });
    }
    if (newRating !== undefined) {
      const user = await this.localBooks.resolveUser(userId);
      await this.bookService.bulkSetRating([link.bookId], newRating, user);
    }

    this.logger.log(
      `[${EVENT}.apply] [end] userId=${userId} bookId=${link.bookId} externalBookId=${link.externalBookId} status=${newStatus ?? 'unchanged'} rating=${newRating ?? 'unchanged'} - remote change applied locally`,
    );
    return true;
  }

  /** Section 4.2: pull a date when the local value is null, or when only the remote side changed. */
  private mergeDateField(local: string | null, remote: string | null, snapshot: string | null | undefined) {
    if (local === null && remote !== null) return { action: 'pull' as const, value: remote };
    return mergeField(local, remote, snapshot === undefined ? undefined : snapshot);
  }

  private logFailure(userId: number, err: unknown): void {
    const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
    this.logger.error(
      `[${EVENT}] [fail] userId=${userId} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - books pull failed`,
    );
  }
}
