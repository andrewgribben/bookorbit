import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ContentFilterRules, ReadStatus, SeriesFollowStatus } from '@bookorbit/types';

import { buildContentFilterClauses } from '../../common/utils/content-filter-sql.utils';
import { DB } from '../../db';
import * as schema from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

export interface ReaderImportBookRow {
  path: string | null;
  bookId: number;
  seriesId: number | null;
  seriesName: string | null;
  seriesIndex: string | null;
  readStatus: ReadStatus | null;
}

interface Scope {
  userId: number;
  libraryIds: number[];
  contentFilters?: ContentFilterRules;
}

const LOOKUP_CHUNK = 5000;

@Injectable()
export class ReaderImportRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findBooksByPaths(paths: string[], scope: Scope): Promise<ReaderImportBookRow[]> {
    const rows: ReaderImportBookRow[] = [];
    for (let i = 0; i < paths.length; i += LOOKUP_CHUNK) {
      rows.push(...(await this.findBooks(inArray(schema.bookFiles.absolutePath, paths.slice(i, i + LOOKUP_CHUNK)), scope)));
    }
    return rows;
  }

  async findBooksByIds(bookIds: number[], scope: Scope): Promise<ReaderImportBookRow[]> {
    const rows: ReaderImportBookRow[] = [];
    for (let i = 0; i < bookIds.length; i += LOOKUP_CHUNK) {
      rows.push(...(await this.findBooks(inArray(schema.books.id, bookIds.slice(i, i + LOOKUP_CHUNK)), scope)));
    }
    return rows;
  }

  /** Every book in the given series, used to match issues by number and to tell whether a series is fully read. */
  findSeriesBooks(seriesIds: number[], scope: Scope): Promise<ReaderImportBookRow[]> {
    if (seriesIds.length === 0) return Promise.resolve([]);
    return this.findBooks(inArray(schema.bookSeriesMemberships.seriesId, seriesIds), scope);
  }

  async findFollowStatuses(userId: number, seriesIds: number[]): Promise<Map<number, SeriesFollowStatus>> {
    if (seriesIds.length === 0) return new Map();
    const rows = await this.db
      .select({ seriesId: schema.userSeriesStatus.seriesId, status: schema.userSeriesStatus.status })
      .from(schema.userSeriesStatus)
      .where(and(eq(schema.userSeriesStatus.userId, userId), inArray(schema.userSeriesStatus.seriesId, seriesIds)));
    return new Map(rows.map((row) => [row.seriesId, row.status as SeriesFollowStatus]));
  }

  /** One row per book file and series membership; callers dedupe by book. */
  private async findBooks(match: SQL, scope: Scope): Promise<ReaderImportBookRow[]> {
    if (scope.libraryIds.length === 0) return [];
    const filterClauses = scope.contentFilters ? buildContentFilterClauses(scope.contentFilters, this.db) : [];
    const rows = await this.db
      .select({
        path: schema.bookFiles.absolutePath,
        bookId: schema.books.id,
        seriesId: schema.bookSeriesMemberships.seriesId,
        seriesName: schema.bookSeries.name,
        seriesIndex: schema.bookSeriesMemberships.seriesIndex,
        readStatus: schema.userBookStatus.status,
      })
      .from(schema.books)
      .leftJoin(schema.bookFiles, eq(schema.bookFiles.bookId, schema.books.id))
      .leftJoin(schema.bookSeriesMemberships, eq(schema.bookSeriesMemberships.bookId, schema.books.id))
      .leftJoin(schema.bookSeries, eq(schema.bookSeries.id, schema.bookSeriesMemberships.seriesId))
      .leftJoin(schema.userBookStatus, and(eq(schema.userBookStatus.bookId, schema.books.id), eq(schema.userBookStatus.userId, scope.userId)))
      .where(and(match, eq(schema.books.status, 'present'), inArray(schema.books.libraryId, scope.libraryIds), ...filterClauses));
    return rows.map((row) => ({ ...row, readStatus: (row.readStatus as ReadStatus | null) ?? null }));
  }
}
