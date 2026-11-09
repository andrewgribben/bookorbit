import { Injectable, Logger } from '@nestjs/common';

import type { ReadingServiceFeature } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import type { LocalBookForMigration } from './readwise-books-local-books.repository';
import { ReadwiseBooksLocalBooksRepository } from './readwise-books-local-books.repository';
import type { ReadwiseBookCreateItem, ReadwiseBookUpdateItem } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { mapBookOrbitStatusToReadwise } from './readwise-books-status-mapping';
import { ReadwiseComicSeriesService } from './readwise-comic-series.service';
import { normalizeReadwiseReview } from './readwise-review.utils';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

const EVENT = 'readwise.books_push';

type BookSnapshot = { status?: string; rating?: number | null; review?: string | null; startedAt?: string | null; finishedAt?: string | null };

function isFeatureEnabled(features: Partial<Record<ReadingServiceFeature, boolean>>, feature: ReadingServiceFeature): boolean {
  // Missing means "not toggled yet"; capabilities are opt-out, not opt-in, so default to on.
  return features[feature] !== false;
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
  ) {}

  async flushUser(userId: number, bookIds: number[]): Promise<void> {
    if (bookIds.length === 0) return;
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return;

    const features = await this.featuresService.getFeatures(userId, 'readwise');
    const startedAt = Date.now();
    let pushed = 0;
    let skipped = 0;
    let failed = 0;

    for (const bookId of bookIds) {
      try {
        const result = await this.pushBook(userId, token, bookId, features);
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
   */
  private async pushSeriesBookIfRouted(
    userId: number,
    token: string,
    bookId: number,
    local: LocalBookForMigration,
  ): Promise<'pushed' | 'skipped' | 'not_routed'> {
    const context = await this.comicSeries.resolveRouting(userId, bookId);
    if (!context) return 'not_routed';

    const externalBookId = await this.comicSeries.ensureSeriesExternalBook(userId, token, context, local.author);
    if (!externalBookId) return 'skipped'; // series has had no reading activity yet

    await this.comicSeries.linkIssueToSeries(userId, bookId, externalBookId);
    return 'pushed';
  }

  private async pushBook(
    userId: number,
    token: string,
    bookId: number,
    features: Partial<Record<ReadingServiceFeature, boolean>>,
  ): Promise<'pushed' | 'skipped'> {
    const local = await this.localBooks.findOne(userId, bookId);
    if (!local) return 'skipped';

    if (isFeatureEnabled(features, 'status')) {
      const seriesResult = await this.pushSeriesBookIfRouted(userId, token, bookId, local);
      if (seriesResult !== 'not_routed') return seriesResult;
    }

    const link = await this.readingServicesRepo.findBookLink(userId, 'readwise', bookId);
    const snapshot: BookSnapshot = (link?.snapshot as BookSnapshot) ?? {};

    const statusChanged = isFeatureEnabled(features, 'status') && local.status !== snapshot.status;
    const ratingChanged = isFeatureEnabled(features, 'rating') && local.rating !== (snapshot.rating ?? null);
    const reviewChanged = isFeatureEnabled(features, 'review') && local.review !== (snapshot.review ?? null);
    const datesChanged =
      isFeatureEnabled(features, 'dates') && (local.startedAt !== (snapshot.startedAt ?? null) || local.finishedAt !== (snapshot.finishedAt ?? null));

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
      const created = await this.client.createBooks(userId, token, [this.toCreateItem(local, pushStatus)]);
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

    await this.client.updateBooks(userId, token, [this.toUpdateItem(link.externalBookId, local, statusChanged ? pushStatus : undefined)]);
    await this.readingServicesRepo.upsertBookLink(userId, 'readwise', bookId, {
      externalBookId: link.externalBookId,
      matchMethod: link.matchMethod,
      snapshot: nextSnapshot,
    });
    return 'pushed';
  }

  private toCreateItem(book: LocalBookForMigration, status: NonNullable<ReturnType<typeof mapBookOrbitStatusToReadwise>>): ReadwiseBookCreateItem {
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
      review: normalizeReadwiseReview(book.review),
    };
  }

  private toUpdateItem(
    externalId: string,
    book: LocalBookForMigration,
    status: ReturnType<typeof mapBookOrbitStatusToReadwise> | undefined,
  ): ReadwiseBookUpdateItem {
    return {
      id: externalId,
      ...(status ? { status } : {}),
      started_reading_at: book.startedAt,
      finished_reading_at: book.finishedAt,
      rating: book.rating,
      review: normalizeReadwiseReview(book.review),
    };
  }
}
