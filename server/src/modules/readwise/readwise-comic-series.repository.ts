import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ReadStatus } from '@bookorbit/types';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import { seriesIndexOrderBy } from '../../common/utils/series-index-sql.utils';

type Db = NodePgDatabase<typeof schema>;

export interface ComicSeriesIssueRow {
  bookId: number;
  pageCount: number | null;
  status: ReadStatus;
  existingLinkExternalBookId: string | null;
  existingLinkMatchMethod: string | null;
}

export interface ComicSeriesInfo {
  seriesId: number;
  seriesName: string;
  libraryId: number;
}

@Injectable()
export class ReadwiseComicSeriesRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** The series a book belongs to, or null when it isn't part of one. One row, no fan-out. */
  async findSeriesForBook(bookId: number): Promise<ComicSeriesInfo | null> {
    const [row] = await this.db
      .select({ seriesId: schema.bookMetadata.seriesId, seriesName: schema.bookSeries.name, libraryId: schema.books.libraryId })
      .from(schema.bookMetadata)
      .innerJoin(schema.bookSeries, eq(schema.bookSeries.id, schema.bookMetadata.seriesId))
      .innerJoin(schema.books, eq(schema.books.id, schema.bookMetadata.bookId))
      .where(eq(schema.bookMetadata.bookId, bookId))
      .limit(1);
    if (!row?.seriesId) return null;
    return { seriesId: row.seriesId, seriesName: row.seriesName, libraryId: row.libraryId };
  }

  /**
   * `book_series` is shared across libraries by name, so issues are limited to the library whose
   * series mode is on. One batched query for every issue of a series eligible for series-mode routing: an issue
   * with no Readwise link yet, or one already routed to the series book (`matchMethod='series'`).
   * An issue with its own individual link is excluded entirely - it stays on its own book. This
   * is the one query the push services call per series per flush, not one query per issue.
   */
  async findEligibleIssues(userId: number, seriesId: number, libraryId: number): Promise<ComicSeriesIssueRow[]> {
    const rows = await this.db
      .select({
        bookId: schema.books.id,
        pageCount: schema.bookMetadata.pageCount,
        seriesIndex: schema.bookMetadata.seriesIndex,
        status: schema.userBookStatus.status,
        existingLinkExternalBookId: schema.readingServiceBookLinks.externalBookId,
        existingLinkMatchMethod: schema.readingServiceBookLinks.matchMethod,
      })
      .from(schema.books)
      .innerJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id))
      .leftJoin(schema.userBookStatus, and(eq(schema.userBookStatus.bookId, schema.books.id), eq(schema.userBookStatus.userId, userId)))
      .leftJoin(
        schema.readingServiceBookLinks,
        and(
          eq(schema.readingServiceBookLinks.bookId, schema.books.id),
          eq(schema.readingServiceBookLinks.userId, userId),
          eq(schema.readingServiceBookLinks.provider, 'readwise'),
        ),
      )
      .where(
        and(
          eq(schema.bookMetadata.seriesId, seriesId),
          eq(schema.books.libraryId, libraryId),
          or(isNull(schema.readingServiceBookLinks.id), eq(schema.readingServiceBookLinks.matchMethod, 'series')),
        ),
      )
      .orderBy(...seriesIndexOrderBy(schema.bookMetadata.seriesIndex, 'ASC'));

    return rows.map((row) => ({
      bookId: row.bookId,
      pageCount: row.pageCount,
      status: (row.status as ReadStatus) ?? 'unread',
      existingLinkExternalBookId: row.existingLinkExternalBookId ?? null,
      existingLinkMatchMethod: row.existingLinkMatchMethod ?? null,
    }));
  }

  async findSeriesBookLink(userId: number, seriesId: number): Promise<schema.ReadingServiceSeriesBookLinkRow | undefined> {
    return this.db.query.readingServiceSeriesBookLinks.findFirst({
      where: and(
        eq(schema.readingServiceSeriesBookLinks.userId, userId),
        eq(schema.readingServiceSeriesBookLinks.provider, 'readwise'),
        eq(schema.readingServiceSeriesBookLinks.seriesId, seriesId),
      ),
    });
  }

  async upsertSeriesBookLink(
    userId: number,
    seriesId: number,
    data: { externalBookId: string; totalPages: number; status: string | null },
  ): Promise<void> {
    await this.db
      .insert(schema.readingServiceSeriesBookLinks)
      .values({ userId, provider: 'readwise', seriesId, ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [
          schema.readingServiceSeriesBookLinks.userId,
          schema.readingServiceSeriesBookLinks.provider,
          schema.readingServiceSeriesBookLinks.seriesId,
        ],
        set: { externalBookId: data.externalBookId, totalPages: data.totalPages, status: data.status, updatedAt: new Date() },
      });
  }

  /**
   * Drops a stale series book: the shared `reading_service_series_book_links` row for
   * `externalBookId`, plus every issue's `reading_service_book_links` row that was routed to
   * it (`matchMethod='series'`). Called once the series' shared Readwise book is confirmed gone
   * remotely (404 on update, a not-found write result, or `status: 'deleted'` on pull), so the
   * next activity on any issue of the series creates a fresh book instead of failing forever
   * against a dead external id. A hard delete, not a `remoteDeleted` flag: the issue links must
   * disappear entirely so `resolveRouting`/`ensureSeriesExternalBook` treat the series as never
   * having had a book, not as one still in need of reconciliation.
   */
  async dropStaleSeriesBook(userId: number, externalBookId: string): Promise<void> {
    await this.db
      .delete(schema.readingServiceSeriesBookLinks)
      .where(
        and(
          eq(schema.readingServiceSeriesBookLinks.userId, userId),
          eq(schema.readingServiceSeriesBookLinks.provider, 'readwise'),
          eq(schema.readingServiceSeriesBookLinks.externalBookId, externalBookId),
        ),
      );
    await this.db
      .delete(schema.readingServiceBookLinks)
      .where(
        and(
          eq(schema.readingServiceBookLinks.userId, userId),
          eq(schema.readingServiceBookLinks.provider, 'readwise'),
          eq(schema.readingServiceBookLinks.externalBookId, externalBookId),
          eq(schema.readingServiceBookLinks.matchMethod, 'series'),
        ),
      );
  }
}
