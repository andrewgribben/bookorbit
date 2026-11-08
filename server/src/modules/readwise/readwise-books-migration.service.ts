import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import type {
  ReadingServiceCapabilities,
  ReadingServiceProvider,
  ReadingServiceRemoteOnlyBooksPage,
  ReadingServiceShelf,
  ReadingServiceShelfItem,
  SyncRunProgressCounters,
} from '@bookorbit/types';
import { Permission } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceRegistry } from '../reading-services/reading-service-registry.service';
import type { ReadingServiceProviderAdapter } from '../reading-services/reading-service-provider';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { buildRemoteIndex, matchBook, type RemoteIndexBook } from '../reading-services/book-matcher';
import { classifyReadwiseOwnership } from './readwise-book-ownership';
import type { ReadwiseBook, ReadwiseBookCreateItem, ReadwiseBookStatus, ReadwiseBookUpdateItem } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError, ReadwiseBooksHttpError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import { ReadwiseBooksLocalBooksRepository, type LocalBookForMigration } from './readwise-books-local-books.repository';
import { mapBookOrbitStatusToReadwise } from './readwise-books-status-mapping';
import { ReadwiseBooksPullService } from './readwise-books-pull.service';
import { ReadwiseOwnedElsewhereService } from './readwise-owned-elsewhere.service';
import {
  READWISE_BOOKS_CREATE_BATCH,
  READWISE_BOOKS_LIST_LIMIT,
  READWISE_BOOKS_UPDATE_BATCH,
  READWISE_MIGRATION_PUSH_PAGE_SIZE,
} from './readwise.constants';
import { ReadwiseSettingsService } from './readwise-settings.service';
import { ReadwiseRepository } from './readwise.repository';

const EVENT = 'readwise.books_migration';
const MIGRATION_INDEX_CACHE_KEY = 'migration-remote-index';
const MIGRATION_MATCHED_CACHE_KEY = 'migration-matched-external-ids';
const MIGRATION_INDEX_TTL_MS = 60 * 60 * 1000;
const MIGRATION_READWISE_ONLY_CACHE_KEY = 'migration-readwise-only';

type MigrationCursor = Record<string, never> | { phase: 'index'; next: string | null } | { phase: 'push'; afterBookId: number };

interface CachedRemoteBook {
  externalId: string;
  isbn13: string | null;
  isbn10: string | null;
  title: string | null;
  author: string | null;
  coverImageUrl: string | null;
  creationOrigin: string | null;
  status: ReadwiseBookStatus;
  rating: number | null;
  review: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

function toRemoteIndexBook(book: ReadwiseBook): CachedRemoteBook {
  return {
    externalId: book.id,
    isbn13: book.product?.isbn ?? null,
    isbn10: null,
    title: book.product?.title ?? null,
    author: book.product?.author ?? null,
    coverImageUrl: book.product?.cover_image ?? null,
    creationOrigin: book.creation_origin ?? null,
    status: book.status,
    rating: book.rating,
    review: book.review,
    startedAt: book.started_reading_at,
    finishedAt: book.finished_reading_at,
  };
}

function toCreateItem(book: LocalBookForMigration, status: NonNullable<ReturnType<typeof mapBookOrbitStatusToReadwise>>): ReadwiseBookCreateItem {
  return {
    product: {
      ...(book.isbn13 ? { isbn: book.isbn13 } : book.isbn10 ? { isbn: book.isbn10 } : {}),
      title: book.title,
      ...(book.author ? { author: book.author } : {}),
    },
    status,
    started_reading_at: book.startedAt,
    finished_reading_at: book.finishedAt,
    rating: book.rating,
    review: book.review,
  };
}

function toUpdateItem(
  externalId: string,
  book: LocalBookForMigration,
  status: ReturnType<typeof mapBookOrbitStatusToReadwise>,
): ReadwiseBookUpdateItem {
  return {
    id: externalId,
    ...(status ? { status } : {}),
    started_reading_at: book.startedAt,
    finished_reading_at: book.finishedAt,
    rating: book.rating,
    review: book.review,
  };
}

/**
 * Readwise Books migration adapter: the initial BookOrbit-authoritative push into Readwise
 * Books. Registers itself with the shared `ReadingServiceRegistry` so the generic migration
 * run loop (`ReadingServiceSyncRunService`) can drive it page by page.
 */
@Injectable()
export class ReadwiseBooksMigrationService implements ReadingServiceProviderAdapter, OnModuleInit {
  private readonly logger = new Logger(ReadwiseBooksMigrationService.name);

  readonly provider: ReadingServiceProvider = 'readwise';
  readonly permission = Permission.ReadwiseSync;
  readonly capabilities: ReadingServiceCapabilities = {
    status: 'both',
    rating: 'both',
    review: 'both',
    dates: 'both',
    owned: 'read',
    sessions: 'both',
    publish_sessions: 'push',
    // S5: push (create/update/delete) and pull both run through the item-link ledger now.
    // Bookmarks have no analogue in the v2 highlights API, so that feature stays absent here.
    highlights: 'both',
    // ReadwiseRecapService builds this from year stats + the session breakdown; read-only, no
    // user toggle changes what's synced, it's just a dashboard display.
    recap_widget: 'read',
  };

  constructor(
    private readonly registry: ReadingServiceRegistry,
    private readonly client: ReadwiseBooksClientService,
    private readonly localBooks: ReadwiseBooksLocalBooksRepository,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly readwiseSettings: ReadwiseSettingsService,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly cache: ReadingServiceCacheService,
    private readonly pullService: ReadwiseBooksPullService,
    private readonly ownedElsewhere: ReadwiseOwnedElsewhereService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async isConnected(userId: number): Promise<boolean> {
    // `enabled` is the highlights-sync toggle, not the connection: a saved token is the connection,
    // unless Readwise has rejected it or the account has no Readwise Books access.
    const settings = await this.readwiseRepo.findSettings(userId);
    if (settings?.disabledReason === 'invalid_token' || settings?.disabledReason === 'no_readwise_books') return false;
    const token = await this.readwiseSettings.getToken(userId);
    return token !== null;
  }

  /** Only the "owned-elsewhere" shelf is supported; Readwise has no friends/trending graph. */
  async getShelf(userId: number, shelf: ReadingServiceShelf): Promise<ReadingServiceShelfItem[]> {
    if (shelf !== 'owned-elsewhere') return [];
    return this.ownedElsewhere.getOwnedElsewhere(userId);
  }

  async pull(userId: number): Promise<void> {
    await this.pullService.pullForUser(userId);
  }

  async previewMigration(userId: number): Promise<{ matched: number; toCreate: number; readwiseOnly: number }> {
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return { matched: 0, toCreate: 0, readwiseOnly: 0 };

    const remoteBooks = await this.fetchFullRemoteIndex(userId, token);
    const index = buildRemoteIndex(remoteBooks.map(toRemoteIndexBook).map(remoteBookToIndexEntry));
    const matchedExternalIds = new Set<string>();

    let matched = 0;
    let toCreate = 0;
    let afterBookId = 0;
    for (;;) {
      const page = await this.localBooks.findPage(userId, afterBookId, READWISE_MIGRATION_PUSH_PAGE_SIZE);
      if (page.length === 0) break;
      for (const book of page) {
        const result = matchBook({ isbn13: book.isbn13, isbn10: book.isbn10, title: book.title, author: book.author }, index);
        if (result) {
          matched += 1;
          matchedExternalIds.add(result.externalId);
        } else if (mapBookOrbitStatusToReadwise(book.status) !== null) {
          toCreate += 1;
        }
      }
      afterBookId = page[page.length - 1]!.bookId;
      if (page.length < READWISE_MIGRATION_PUSH_PAGE_SIZE) break;
    }

    const readwiseOnly = remoteBooks.filter((b) => !matchedExternalIds.has(b.id)).length;
    return { matched, toCreate, readwiseOnly };
  }

  /**
   * One page of the migration. Phase 1 pages the full remote library into a cache entry; phase 2
   * pages local books 200 at a time, matches, and pushes creates/updates. Returning null signals
   * the run is complete.
   */
  async migratePage(userId: number, cursor: Record<string, unknown>, counters: SyncRunProgressCounters): Promise<Record<string, unknown> | null> {
    const typedCursor = cursor as MigrationCursor;

    if (!('phase' in typedCursor)) {
      return this.runIndexPage(userId, { phase: 'index', next: null });
    }
    if (typedCursor.phase === 'index') {
      return this.runIndexPage(userId, typedCursor);
    }
    return this.runPushPage(userId, typedCursor, counters);
  }

  private async runIndexPage(userId: number, cursor: { phase: 'index'; next: string | null }): Promise<Record<string, unknown>> {
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) throw new Error('Readwise is not connected for this user');

    const page = await this.callReadwise(userId, () =>
      this.client.listBooks(userId, token, { limit: READWISE_BOOKS_LIST_LIMIT, cursor: cursor.next ?? undefined }),
    );
    // A fresh run starts at next=null; drop any index left by an earlier run so books are not listed twice.
    const existing = cursor.next === null ? [] : ((await this.cache.get<CachedRemoteBook[]>(userId, this.provider, MIGRATION_INDEX_CACHE_KEY)) ?? []);
    const accumulated = [...existing, ...page.results.map(toRemoteIndexBook)];
    await this.cache.set(userId, this.provider, MIGRATION_INDEX_CACHE_KEY, accumulated, MIGRATION_INDEX_TTL_MS);

    if (page.next === null) {
      await this.cache.set(userId, this.provider, MIGRATION_MATCHED_CACHE_KEY, [] as string[], MIGRATION_INDEX_TTL_MS);
      return { phase: 'push', afterBookId: 0 };
    }
    return { phase: 'index', next: page.next };
  }

  private async runPushPage(
    userId: number,
    cursor: { phase: 'push'; afterBookId: number },
    counters: SyncRunProgressCounters,
  ): Promise<Record<string, unknown> | null> {
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) throw new Error('Readwise is not connected for this user');

    const remoteBooks = (await this.cache.get<CachedRemoteBook[]>(userId, this.provider, MIGRATION_INDEX_CACHE_KEY)) ?? [];
    const index = buildRemoteIndex(remoteBooks.map(remoteBookToIndexEntry));
    const remoteByExternalId = new Map(remoteBooks.map((b) => [b.externalId, b]));
    const matchedSoFar = new Set((await this.cache.get<string[]>(userId, this.provider, MIGRATION_MATCHED_CACHE_KEY)) ?? []);

    const page = await this.localBooks.findPage(userId, cursor.afterBookId, READWISE_MIGRATION_PUSH_PAGE_SIZE);
    if (page.length === 0) {
      await this.finishMigration(userId, remoteBooks, matchedSoFar, counters);
      return null;
    }

    const createItems: { book: LocalBookForMigration; item: ReadwiseBookCreateItem }[] = [];
    const updateItems: { book: LocalBookForMigration; externalId: string; matchMethod: string; item: ReadwiseBookUpdateItem }[] = [];
    // Matched books whose remote values already equal BookOrbit's: linked silently, no PATCH sent.
    const silentlyLinkedItems: { book: LocalBookForMigration; externalId: string; matchMethod: string }[] = [];

    for (const book of page) {
      counters.scanned += 1;
      const result = matchBook({ isbn13: book.isbn13, isbn10: book.isbn10, title: book.title, author: book.author }, index);
      const pushStatus = mapBookOrbitStatusToReadwise(book.status);

      if (result) {
        matchedSoFar.add(result.externalId);
        counters.matched += 1;
        const remote = remoteByExternalId.get(result.externalId);
        if (remote && this.remoteAlreadyMatches(remote, book, pushStatus)) {
          silentlyLinkedItems.push({ book, externalId: result.externalId, matchMethod: result.method });
        } else {
          if (remote) this.logOverwrite(userId, book.bookId, result.externalId, remote, pushStatus);
          updateItems.push({
            book,
            externalId: result.externalId,
            matchMethod: result.method,
            item: toUpdateItem(result.externalId, book, pushStatus),
          });
        }
      } else if (pushStatus !== null) {
        createItems.push({ book, item: toCreateItem(book, pushStatus) });
      } else {
        counters.skipped += 1;
      }
    }

    try {
      for (const s of silentlyLinkedItems) {
        await this.readingServicesRepo.upsertBookLink(userId, this.provider, s.book.bookId, {
          externalBookId: s.externalId,
          matchMethod: s.matchMethod,
          snapshot: {
            status: s.book.status,
            rating: s.book.rating,
            review: s.book.review,
            startedAt: s.book.startedAt,
            finishedAt: s.book.finishedAt,
          },
        });
      }
      // Readwise's PATCH /books caps a batch at 100 items and POST /books at 10 (readwise-api.md
      // §5); READWISE_MIGRATION_PUSH_PAGE_SIZE (200) can exceed both, so each call is chunked to
      // the documented limit. A batch that still 400s is retried item by item rather than
      // aborting the whole migration run; only items that fail individually count as `failed`.
      await this.pushUpdatesInBatches(userId, token, updateItems, counters);
      await this.pushCreatesInBatches(userId, token, createItems, counters, matchedSoFar);
    } catch (err) {
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      this.logger.error(
        `[${EVENT}] [fail] userId=${userId} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - migration push page failed`,
      );
      throw err;
    }

    await this.cache.set(userId, this.provider, MIGRATION_MATCHED_CACHE_KEY, [...matchedSoFar], MIGRATION_INDEX_TTL_MS);

    const afterBookId = page[page.length - 1]!.bookId;
    if (page.length < READWISE_MIGRATION_PUSH_PAGE_SIZE) {
      await this.finishMigration(userId, remoteBooks, matchedSoFar, counters);
      return null;
    }
    return { phase: 'push', afterBookId };
  }

  private async finishMigration(
    userId: number,
    remoteBooks: CachedRemoteBook[],
    matchedExternalIds: Set<string>,
    counters: SyncRunProgressCounters,
  ): Promise<void> {
    // D1: Readwise-only books are counted as skipped and classified by ownership for the
    // migration-screen list; nothing here is pushed to Readwise or written locally.
    const seen = new Set<string>();
    const readwiseOnly = remoteBooks.filter((b) => !matchedExternalIds.has(b.externalId) && !seen.has(b.externalId) && seen.add(b.externalId));
    counters.skipped += readwiseOnly.length;
    const classified = readwiseOnly.map((b) => ({
      externalId: b.externalId,
      title: b.title,
      author: b.author,
      // The Books API response captured by `ReadwiseBooksClientService` has no public web URL
      // for a book entry, so this stays null rather than guessing a URL shape.
      externalUrl: null,
      coverImageUrl: b.coverImageUrl,
      ownership: classifyReadwiseOwnership(b.creationOrigin),
    }));
    await this.cache.set(userId, this.provider, MIGRATION_READWISE_ONLY_CACHE_KEY, classified, MIGRATION_INDEX_TTL_MS);
  }

  /**
   * Paginated read of the classification `finishMigration` cached from the last completed
   * migration run. Returns an empty page (not an error) if no migration has finished yet or
   * the cache entry has expired, since this is a read-only convenience list, not a live query.
   */
  async listRemoteOnlyBooks(userId: number, offset: number, limit: number): Promise<ReadingServiceRemoteOnlyBooksPage> {
    const classified =
      (await this.cache.get<
        Array<{
          externalId: string;
          title: string | null;
          author: string | null;
          externalUrl: string | null;
          coverImageUrl: string | null;
          ownership: 'owned' | 'not_owned' | 'unknown';
        }>
      >(userId, this.provider, MIGRATION_READWISE_ONLY_CACHE_KEY)) ?? [];
    const page = classified.slice(offset, offset + limit);
    const next = offset + limit < classified.length ? offset + limit : null;
    return { items: page, next, total: classified.length };
  }

  private async fetchFullRemoteIndex(userId: number, token: string): Promise<ReadwiseBook[]> {
    const all: ReadwiseBook[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await this.callReadwise(userId, () => this.client.listBooks(userId, token, { limit: READWISE_BOOKS_LIST_LIMIT, cursor }));
      all.push(...page.results);
      if (!page.next) break;
      cursor = page.next;
    }
    return all;
  }

  /** Runs one Readwise Books API call, turning a 403 into disabled_reason=no_readwise_books. */
  private async callReadwise<T>(userId: number, run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (err) {
      if (err instanceof ReadwiseBooksForbiddenError) {
        await this.readwiseRepo.upsertSettings(userId, { disabledReason: 'no_readwise_books', enabled: false });
      }
      throw err;
    }
  }

  /** Account-level failures (bad token, no Readwise Books) must still abort the whole run. */
  /** True only when Readwise answered with a 4xx, i.e. it rejected the request and wrote nothing. */
  private isRejectedRequest(err: unknown): boolean {
    return err instanceof ReadwiseBooksHttpError && err.status >= 400 && err.status < 500;
  }

  private isAbortingError(err: unknown): boolean {
    return err instanceof ReadwiseUnauthorizedError || err instanceof ReadwiseBooksForbiddenError;
  }

  private async recordUpdateSuccess(userId: number, u: { book: LocalBookForMigration; externalId: string; matchMethod: string }): Promise<void> {
    await this.readingServicesRepo.upsertBookLink(userId, this.provider, u.book.bookId, {
      externalBookId: u.externalId,
      matchMethod: u.matchMethod,
      snapshot: {
        status: u.book.status,
        rating: u.book.rating,
        review: u.book.review,
        startedAt: u.book.startedAt,
        finishedAt: u.book.finishedAt,
      },
    });
  }

  /**
   * PATCHes `updateItems` in chunks of at most `READWISE_BOOKS_UPDATE_BATCH` (the Readwise-
   * documented limit). If a whole chunk 400s (or otherwise fails for a reason that isn't an
   * account-level auth/forbidden error), it is retried one item at a time so one bad record
   * doesn't sink its neighbours; items still failing after the retry are counted in
   * `counters.failed` and logged with the BookOrbit bookId and the Readwise error, but the run
   * continues.
   */
  private async pushUpdatesInBatches(
    userId: number,
    token: string,
    updateItems: { book: LocalBookForMigration; externalId: string; matchMethod: string; item: ReadwiseBookUpdateItem }[],
    counters: SyncRunProgressCounters,
  ): Promise<void> {
    for (let i = 0; i < updateItems.length; i += READWISE_BOOKS_UPDATE_BATCH) {
      const batch = updateItems.slice(i, i + READWISE_BOOKS_UPDATE_BATCH);
      try {
        await this.callReadwise(userId, () =>
          this.client.updateBooks(
            userId,
            token,
            batch.map((u) => u.item),
          ),
        );
      } catch (err) {
        if (this.isAbortingError(err)) throw err;
        if (!this.isRejectedRequest(err)) {
          // The request may have been applied (bad response body, network drop): never resend blind.
          for (const u of batch) {
            counters.failed += 1;
            this.logItemFailure(userId, 'update', u.book.bookId, u.externalId, err);
          }
          continue;
        }
        for (const u of batch) {
          try {
            await this.callReadwise(userId, () => this.client.updateBooks(userId, token, [u.item]));
            await this.recordUpdateSuccess(userId, u);
            counters.updated += 1;
          } catch (itemErr) {
            if (this.isAbortingError(itemErr)) throw itemErr;
            counters.failed += 1;
            this.logItemFailure(userId, 'update', u.book.bookId, u.externalId, itemErr);
          }
        }
        continue;
      }
      for (const u of batch) {
        await this.recordUpdateSuccess(userId, u);
        counters.updated += 1;
      }
    }
  }

  private async recordCreateResults(
    userId: number,
    batch: { book: LocalBookForMigration; item: ReadwiseBookCreateItem }[],
    results: { id: string; status: 'created' | 'existing' | 'error'; book_id?: string; error?: string }[],
    counters: SyncRunProgressCounters,
    matchedSoFar: Set<string>,
  ): Promise<void> {
    for (let i = 0; i < batch.length; i++) {
      const created = results[i];
      const entry = batch[i]!;
      if (!created || created.status === 'error' || !created.book_id) {
        counters.failed += 1;
        this.logItemFailure(userId, 'create', entry.book.bookId, null, new Error(created?.error ?? 'Readwise returned no book_id'));
        continue;
      }
      matchedSoFar.add(created.book_id);
      await this.readingServicesRepo.upsertBookLink(userId, this.provider, entry.book.bookId, {
        externalBookId: created.book_id,
        matchMethod: 'created',
        snapshot: {
          status: entry.book.status,
          rating: entry.book.rating,
          review: entry.book.review,
          startedAt: entry.book.startedAt,
          finishedAt: entry.book.finishedAt,
        },
      });
      counters.created += 1;
    }
  }

  /**
   * POSTs `createItems` in chunks of at most `READWISE_BOOKS_CREATE_BATCH` (Readwise accepts
   * 1-10 per create call; the migration page is far larger). Same per-item retry-and-continue
   * policy as `pushUpdatesInBatches` for a chunk that 400s outright.
   */
  private async pushCreatesInBatches(
    userId: number,
    token: string,
    createItems: { book: LocalBookForMigration; item: ReadwiseBookCreateItem }[],
    counters: SyncRunProgressCounters,
    matchedSoFar: Set<string>,
  ): Promise<void> {
    for (let i = 0; i < createItems.length; i += READWISE_BOOKS_CREATE_BATCH) {
      const batch = createItems.slice(i, i + READWISE_BOOKS_CREATE_BATCH);
      let results: Awaited<ReturnType<ReadwiseBooksClientService['createBooks']>>;
      try {
        results = await this.callReadwise(userId, () =>
          this.client.createBooks(
            userId,
            token,
            batch.map((c) => c.item),
          ),
        );
      } catch (err) {
        if (this.isAbortingError(err)) throw err;
        if (!this.isRejectedRequest(err)) {
          // The books may have been created already; resending could add copies, so fail the batch instead.
          for (const c of batch) {
            counters.failed += 1;
            this.logItemFailure(userId, 'create', c.book.bookId, null, err);
          }
          continue;
        }
        for (const c of batch) {
          let singleResult: typeof results;
          try {
            singleResult = await this.callReadwise(userId, () => this.client.createBooks(userId, token, [c.item]));
          } catch (itemErr) {
            if (this.isAbortingError(itemErr)) throw itemErr;
            counters.failed += 1;
            this.logItemFailure(userId, 'create', c.book.bookId, null, itemErr);
            continue;
          }
          await this.recordCreateResults(userId, [c], singleResult, counters, matchedSoFar);
        }
        continue;
      }
      await this.recordCreateResults(userId, batch, results, counters, matchedSoFar);
    }
  }

  /** Per-item migration push failure: logged with the BookOrbit bookId and the Readwise error so a batch 400 is diagnosable without aborting the run. */
  private logItemFailure(userId: number, op: 'update' | 'create', bookId: number, externalId: string | null, err: unknown): void {
    const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
    this.logger.error(
      `[${EVENT}] [fail] userId=${userId} op=${op} bookId=${bookId} externalId=${externalId ?? 'null'} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - migration item push failed, run continues`,
    );
  }

  /**
   * BookOrbit always wins a mismatch on rating/review/dates/status: when nothing differs, the
   * link is recorded without sending a PATCH (nothing to overwrite), which matters on a
   * reconnect-safe first connect so a remote value that already agrees with BookOrbit's never
   * gets logged as if it had been clobbered.
   */
  private remoteAlreadyMatches(remote: CachedRemoteBook, book: LocalBookForMigration, pushStatus: ReadwiseBookStatus | null): boolean {
    return (
      remote.status === pushStatus &&
      remote.rating === book.rating &&
      remote.review === book.review &&
      remote.startedAt === book.startedAt &&
      remote.finishedAt === book.finishedAt
    );
  }

  /** Records, for the sync run log, the remote value BookOrbit is about to overwrite. */
  private logOverwrite(userId: number, bookId: number, externalId: string, remote: CachedRemoteBook, pushStatus: ReadwiseBookStatus | null): void {
    this.logger.log(
      `[${EVENT}] [end] userId=${userId} bookId=${bookId} externalId=${externalId} previousStatus=${remote.status} previousRating=${remote.rating ?? null} previousReview=${sanitizeLogValue(remote.review ?? '')} previousStartedAt=${remote.startedAt ?? null} previousFinishedAt=${remote.finishedAt ?? null} newStatus=${pushStatus ?? null} - BookOrbit overwrote a differing remote value`,
    );
  }
}

function remoteBookToIndexEntry(book: CachedRemoteBook): RemoteIndexBook {
  return { externalId: book.externalId, isbn13: book.isbn13, isbn10: book.isbn10, title: book.title, author: book.author };
}
