import { Injectable, Logger } from '@nestjs/common';

import type { ReadingServiceFeature } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { isLibraryFeatureEnabled, type EffectiveLibrarySetting } from '../reading-services/library-scope.utils';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServiceLibraryScopeService } from '../reading-services/reading-service-library-scope.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import type { LocalBookForMigration } from './readwise-books-local-books.repository';
import { ReadwiseBooksLocalBooksRepository } from './readwise-books-local-books.repository';
import type { ReadwiseBookCreateItem, ReadwiseBookUpdateItem } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { mapBookOrbitStatusToReadwise } from './readwise-books-status-mapping';
import type { ComicSeriesRoutingContext } from './readwise-comic-series.service';
import { ReadwiseComicSeriesService } from './readwise-comic-series.service';
import { normalizeReadwiseReview } from './readwise-review.utils';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

const EVENT = 'readwise.books_push';

type BookSnapshot = { status?: string; rating?: number | null; review?: string | null; startedAt?: string | null; finishedAt?: string | null };

/** Which of the four book fields are effectively on for one book, after merging the provider toggle with its library's override. */
interface EffectiveBookFeatures {
  status: boolean;
  rating: boolean;
  review: boolean;
  dates: boolean;
}

function resolveBookFeatures(
  providerFeatures: Partial<Record<ReadingServiceFeature, boolean>>,
  librarySettings: ReadonlyMap<number, EffectiveLibrarySetting>,
  libraryId: number,
): EffectiveBookFeatures {
  return {
    status: isLibraryFeatureEnabled(librarySettings, libraryId, 'status', providerFeatures.status !== false),
    rating: isLibraryFeatureEnabled(librarySettings, libraryId, 'rating', providerFeatures.rating !== false),
    review: isLibraryFeatureEnabled(librarySettings, libraryId, 'review', providerFeatures.review !== false),
    dates: isLibraryFeatureEnabled(librarySettings, libraryId, 'dates', providerFeatures.dates !== false),
  };
}

/**
 * Pushes `book.status-changed` / `book.rating-changed` batches to Readwise Books. Only fields
 * that differ from the link's last-synced snapshot are sent, which is also the echo-suppression
 * mechanism: a pull writes the snapshot before applying its own local change, so the event that
 * change raises sees local === snapshot here and pushes nothing.
 */
@Injectable()
export class ReadwiseBooksPushService {
  private readonly logger = new Logger(ReadwiseBooksPushService.name);

  constructor(
    private readonly client: ReadwiseBooksClientService,
    private readonly localBooks: ReadwiseBooksLocalBooksRepository,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly readwiseSettings: ReadwiseSettingsService,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly featuresService: ReadingServiceFeaturesService,
    private readonly comicSeries: ReadwiseComicSeriesService,
    private readonly libraryScopeService: ReadingServiceLibraryScopeService,
  ) {}

  async flushUser(userId: number, bookIds: number[]): Promise<void> {
    if (bookIds.length === 0) return;
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return;

    const [features, librarySettings] = await Promise.all([
      this.featuresService.getFeatures(userId, 'readwise'),
      this.libraryScopeService.getEffectiveLibrarySettingsForUserId(userId, 'readwise'),
    ]);
    // Reused across the whole batch so two issues of the same series only pay for
    // `findEligibleIssues`'s series scan once, not once per issue.
    const seriesCache = new Map<number, ComicSeriesRoutingContext | null>();
    const startedAt = Date.now();
    let pushed = 0;
    let skipped = 0;
    let failed = 0;

    for (const bookId of bookIds) {
      try {
        const result = await this.pushBook(userId, token, bookId, features, librarySettings, seriesCache);
        if (result === 'pushed') pushed += 1;
        else skipped += 1;
      } catch (err) {
        failed += 1;
        if (err instanceof ReadwiseBooksForbiddenError) {
          await this.readwiseRepo.upsertSettings(userId, { disabledReason: 'no_readwise_books', enabled: false });
          break;
        }
        const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
        this.logger.error(
          `[${EVENT}] [fail] userId=${userId} bookId=${bookId} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - books push failed`,
        );
      }
    }

    this.logger.log(
      `[${EVENT}] [end] userId=${userId} count=${bookIds.length} durationMs=${Date.now() - startedAt} pushed=${pushed} skipped=${skipped} failed=${failed} - books push batch completed`,
    );
    if (failed > 0) throw new Error(`${failed} of ${bookIds.length} books failed to push to Readwise`);
  }

  /**
   * Routes a book that belongs to a series-mode library to the series' shared Readwise book
   * instead of its own. Returns 'not_routed' for a book that pushes normally (no series, series
   * mode off, or already individually linked) so the caller falls through to that logic.
   *
   * Series routing itself never depends on the `status` feature (a status-off library still
   * groups issues into one shared book) - only whether the series book's status field is sent
   * depends on it, via `statusOn`.
   */
  private async pushSeriesBookIfRouted(
    userId: number,
    token: string,
    bookId: number,
    local: LocalBookForMigration,
    statusOn: boolean,
    seriesCache: Map<number, ComicSeriesRoutingContext | null>,
  ): Promise<'pushed' | 'skipped' | 'not_routed'> {
    const context = await this.comicSeries.resolveRouting(userId, bookId, seriesCache);
    if (!context) return 'not_routed';

    const externalBookId = await this.comicSeries.ensureSeriesExternalBook(userId, token, context, local.author, statusOn);
    if (!externalBookId) return 'skipped'; // series has had no reading activity yet

    await this.comicSeries.linkIssueToSeries(userId, bookId, externalBookId);
    return 'pushed';
  }

  private async pushBook(
    userId: number,
    token: string,
    bookId: number,
    features: Partial<Record<ReadingServiceFeature, boolean>>,
    librarySettings: ReadonlyMap<number, EffectiveLibrarySetting>,
    seriesCache: Map<number, ComicSeriesRoutingContext | null>,
  ): Promise<'pushed' | 'skipped'> {
    const local = await this.localBooks.findOne(userId, bookId);
    if (!local) return 'skipped';

    const bookFeatures = resolveBookFeatures(features, librarySettings, local.libraryId);

    const seriesResult = await this.pushSeriesBookIfRouted(userId, token, bookId, local, bookFeatures.status, seriesCache);
    if (seriesResult !== 'not_routed') return seriesResult;

    const link = await this.readingServicesRepo.findBookLink(userId, 'readwise', bookId);
    const snapshot: BookSnapshot = (link?.snapshot as BookSnapshot) ?? {};

    const statusChanged = bookFeatures.status && local.status !== snapshot.status;
    const ratingChanged = bookFeatures.rating && local.rating !== (snapshot.rating ?? null);
    const reviewChanged = bookFeatures.review && local.review !== (snapshot.review ?? null);
    const datesChanged =
      bookFeatures.dates && (local.startedAt !== (snapshot.startedAt ?? null) || local.finishedAt !== (snapshot.finishedAt ?? null));

    if (!statusChanged && !ratingChanged && !reviewChanged && !datesChanged) return 'skipped';

    const pushStatus = mapBookOrbitStatusToReadwise(local.status);
    const nextSnapshot: BookSnapshot = {
      status: statusChanged ? local.status : snapshot.status,
      rating: ratingChanged ? local.rating : (snapshot.rating ?? null),
      review: reviewChanged ? local.review : (snapshot.review ?? null),
      startedAt: datesChanged ? local.startedAt : (snapshot.startedAt ?? null),
      finishedAt: datesChanged ? local.finishedAt : (snapshot.finishedAt ?? null),
    };

    if (!link) {
      if (pushStatus === null) return 'skipped'; // never push an unread book that has no link yet
      const created = await this.client.createBooks(userId, token, [this.toCreateItem(local, pushStatus, bookFeatures)]);
      const result = created[0];
      if (!result || result.status === 'error' || !result.book_id) {
        throw new Error(result?.error ?? 'Readwise Books create returned no book_id');
      }
      await this.readingServicesRepo.upsertBookLink(userId, 'readwise', bookId, {
        externalBookId: result.book_id,
        matchMethod: 'created',
        snapshot: nextSnapshot,
      });
      return 'pushed';
    }

    if (link.remoteDeleted) return 'skipped'; // the user removed this book on Readwise; don't resurrect it

    await this.client.updateBooks(userId, token, [
      this.toUpdateItem(link.externalBookId, local, statusChanged ? pushStatus : undefined, bookFeatures),
    ]);
    await this.readingServicesRepo.upsertBookLink(userId, 'readwise', bookId, {
      externalBookId: link.externalBookId,
      matchMethod: link.matchMethod,
      snapshot: nextSnapshot,
    });
    return 'pushed';
  }

  private toCreateItem(
    book: LocalBookForMigration,
    status: NonNullable<ReturnType<typeof mapBookOrbitStatusToReadwise>>,
    features: EffectiveBookFeatures,
  ): ReadwiseBookCreateItem {
    return {
      product: {
        ...(book.isbn13 ? { isbn: book.isbn13 } : book.isbn10 ? { isbn: book.isbn10 } : {}),
        title: book.title,
        ...(book.author ? { author: book.author } : {}),
      },
      ...(features.status ? { status } : {}),
      ...(features.dates ? { started_reading_at: book.startedAt, finished_reading_at: book.finishedAt } : {}),
      ...(features.rating ? { rating: book.rating } : {}),
      ...(features.review ? { review: normalizeReadwiseReview(book.review) } : {}),
    };
  }

  private toUpdateItem(
    externalId: string,
    book: LocalBookForMigration,
    status: ReturnType<typeof mapBookOrbitStatusToReadwise> | undefined,
    features: EffectiveBookFeatures,
  ): ReadwiseBookUpdateItem {
    return {
      id: externalId,
      ...(status ? { status } : {}),
      ...(features.dates ? { started_reading_at: book.startedAt, finished_reading_at: book.finishedAt } : {}),
      ...(features.rating ? { rating: book.rating } : {}),
      ...(features.review ? { review: normalizeReadwiseReview(book.review) } : {}),
    };
  }
}
