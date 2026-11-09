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
   * One batched query for every issue of a series eligible for series-mode routing: an issue
   * with no Readwise link yet, or one already routed to the series book (`matchMethod='series'`).
   * An issue with its own individual link is excluded entirely - it stays on its own book. This
   * is the one query the push services call per series per flush, not one query per issue.
   */
  async findEligibleIssues(userId: number, seriesId: number): Promise<ComicSeriesIssueRow[]> {
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
}
