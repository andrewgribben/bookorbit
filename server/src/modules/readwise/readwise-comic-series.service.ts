import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import type { ReadwiseBookCreateItem, ReadwiseBookStatus, ReadwiseBookUpdateItem } from './readwise-books-client.service';
import { ReadwiseBooksClientService } from './readwise-books-client.service';
import { mapBookOrbitStatusToReadwise } from './readwise-books-status-mapping';
import { ReadwiseComicSeriesRepository } from './readwise-comic-series.repository';
import { computeComicSeriesPageMapping, computeComicSeriesStatus } from './readwise-comic-series.utils';

const EVENT = 'readwise.comic_series';

export interface ComicSeriesPageRange {
  pageOffset: number;
  issuePages: number;
}

/** Everything the books and sessions push services need to route one issue through its series. */
export interface ComicSeriesRoutingContext {
  seriesId: number;
  seriesName: string;
  totalPages: number;
  status: ReadwiseBookStatus | null;
  pageRanges: ReadonlyMap<number, ComicSeriesPageRange>;
}

/**
 * Resolves and maintains the shared Readwise book for a comic series: one Readwise book per
 * series when the library's series mode is on, instead of one per issue.
 * Routing is decided per book on every push (not cached), so toggling series mode, adding an
 * issue, or giving an issue its own individual link all take effect on the very next push
 * without a separate reconciliation pass.
 */
@Injectable()
export class ReadwiseComicSeriesService {
  private readonly logger = new Logger(ReadwiseComicSeriesService.name);

  constructor(
    private readonly repo: ReadwiseComicSeriesRepository,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly client: ReadwiseBooksClientService,
  ) {}

  /**
   * Null means "route this book the normal, one-book-per-issue way": no series, the library's
   * series mode is off, or the book already has its own individual Readwise link (owner
   * decision: individually-linked issues are never merged into a series book).
   */
  async resolveRouting(userId: number, bookId: number): Promise<ComicSeriesRoutingContext | null> {
    const series = await this.repo.findSeriesForBook(bookId);
    if (!series) return null;

    const seriesModeOn = await this.readingServicesRepo.getLibrarySeriesModeEnabled(userId, 'readwise', series.libraryId);
    if (!seriesModeOn) return null;

    const existingLink = await this.readingServicesRepo.findBookLink(userId, 'readwise', bookId);
    if (existingLink && existingLink.matchMethod !== 'series') return null;

    const issues = await this.repo.findEligibleIssues(userId, series.seriesId, series.libraryId);
    if (issues.length === 0 || !issues.some((issue) => issue.bookId === bookId)) return null;

    const mapping = computeComicSeriesPageMapping(issues.map((issue) => ({ bookId: issue.bookId, pageCount: issue.pageCount })));
    const pageRanges = new Map(mapping.issues.map((issue) => [issue.bookId, { pageOffset: issue.pageOffset, issuePages: issue.issuePages }]));

    const status = computeComicSeriesStatus(
      issues.map((issue, index) => ({
        bookId: issue.bookId,
        readwiseStatus: mapBookOrbitStatusToReadwise(issue.status),
        isLast: index === issues.length - 1,
      })),
    );

    return { seriesId: series.seriesId, seriesName: series.seriesName, totalPages: mapping.totalPages, status, pageRanges };
  }

  /**
   * Creates the series book on first activity, or raises its `manual_total_pages`/status when
   * they changed, always before the caller posts any session against it (Readwise rejects a
   * session page past the book's current total). Returns null while the series has had no
   * reading activity yet (owner decision: don't create the book until something has started).
   */
  async ensureSeriesExternalBook(
    userId: number,
    token: string,
    context: ComicSeriesRoutingContext,
    authorHint: string | null,
  ): Promise<string | null> {
    const existing = await this.repo.findSeriesBookLink(userId, context.seriesId);

    if (!existing) {
      if (context.status === null) return null;
      const item: ReadwiseBookCreateItem = {
        product: { title: context.seriesName, ...(authorHint ? { author: authorHint } : {}) },
        status: context.status,
        manual_total_pages: context.totalPages,
      };
      const [result] = await this.client.createBooks(userId, token, [item]);
      if (!result || result.status === 'error' || !result.book_id) {
        throw new Error(result?.error ?? 'Readwise Books create returned no book_id for a comic series');
      }
      await this.repo.upsertSeriesBookLink(userId, context.seriesId, {
        externalBookId: result.book_id,
        totalPages: context.totalPages,
        status: context.status,
      });
      this.logger.log(
        `[${EVENT}] [end] userId=${userId} seriesId=${context.seriesId} totalPages=${context.totalPages} status=${context.status} - comic series book created`,
      );
      return result.book_id;
    }

    // Never lower the total: earlier sessions may already reach past a smaller one.
    const totalPages = Math.max(existing.totalPages, context.totalPages);
    if (existing.totalPages !== totalPages || existing.status !== context.status) {
      const update: ReadwiseBookUpdateItem = {
        id: existing.externalBookId,
        manual_total_pages: totalPages,
        ...(context.status ? { status: context.status } : {}),
      };
      await this.client.updateBooks(userId, token, [update]);
      await this.repo.upsertSeriesBookLink(userId, context.seriesId, {
        externalBookId: existing.externalBookId,
        totalPages,
        status: context.status,
      });
    }
    return existing.externalBookId;
  }

  /** Records that this issue's activity now routes to the series' shared book. */
  async linkIssueToSeries(userId: number, bookId: number, externalBookId: string): Promise<void> {
    await this.readingServicesRepo.upsertBookLink(userId, 'readwise', bookId, {
      externalBookId,
      matchMethod: 'series',
      snapshot: {},
    });
  }

  logPushFailure(userId: number, bookId: number, err: unknown): void {
    const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
    this.logger.error(
      `[${EVENT}] [fail] userId=${userId} bookId=${bookId} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - comic series routing failed`,
    );
  }
}
