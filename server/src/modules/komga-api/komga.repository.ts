import { Inject, Injectable } from '@nestjs/common';
import { SQL, and, asc, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { ContentFilterRules } from '@bookorbit/types';
import { buildContentFilterClauses } from '../../common/utils/content-filter-sql.utils';
import { compareSeriesIndexSql, seriesIndexOrderBy } from '../../common/utils/series-index-sql.utils';
import { DB } from '../../db';
import * as schema from '../../db/schema';
import {
  authors,
  bookAuthors,
  bookFiles,
  bookMetadata,
  bookSeries,
  bookSeriesMemberships,
  books,
  collectionBooks,
  collections,
  readingProgress,
  userBookStatus,
} from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

export interface KomgaProgressRow {
  bookId: number;
  pageNumber: number | null;
  percentage: number;
  updatedAt: Date;
  lastReadAt: Date;
}

export interface KomgaBookFact {
  bookId: number;
  libraryId: number;
  fileId: number | null;
  format: string | null;
  role: string | null;
  sizeBytes: number | null;
  fileHash: string | null;
  mtime: Date | null;
}

export interface KomgaSeriesFact {
  seriesId: number;
  createdAt: Date;
  updatedAt: Date;
  libraryId: number | null;
}

export interface KomgaSeriesDetailFact {
  seriesId: number;
  name: string;
  expectedBookCount: number | null;
  createdAt: Date;
  updatedAt: Date;
  libraryId: number | null;
  bookCount: number;
  readCount: number;
  readingCount: number;
}

export interface KomgaCollectionRow {
  id: number;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class KomgaRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findProgressByBookIds(userId: number, bookIds: number[]): Promise<KomgaProgressRow[]> {
    if (bookIds.length === 0) return [];

    const rows = await this.db
      .selectDistinctOn([books.id], {
        bookId: books.id,
        pageNumber: readingProgress.pageNumber,
        percentage: readingProgress.percentage,
        updatedAt: readingProgress.updatedAt,
        lastReadAt: readingProgress.lastReadAt,
      })
      .from(readingProgress)
      .innerJoin(bookFiles, eq(bookFiles.id, readingProgress.bookFileId))
      .innerJoin(books, eq(books.id, bookFiles.bookId))
      .where(and(eq(readingProgress.userId, userId), inArray(books.id, bookIds)))
      .orderBy(books.id, sql`${readingProgress.lastReadAt} desc`);

    return rows;
  }

  async findBookFacts(bookIds: number[]): Promise<KomgaBookFact[]> {
    if (bookIds.length === 0) return [];

    return this.db
      .select({
        bookId: books.id,
        libraryId: books.libraryId,
        fileId: bookFiles.id,
        format: bookFiles.format,
        role: bookFiles.role,
        sizeBytes: bookFiles.sizeBytes,
        fileHash: bookFiles.fileHash,
        mtime: bookFiles.mtime,
      })
      .from(books)
      .leftJoin(bookFiles, eq(bookFiles.id, books.primaryFileId))
      .where(inArray(books.id, bookIds));
  }

  async findSeriesFacts(seriesIds: number[]): Promise<KomgaSeriesFact[]> {
    if (seriesIds.length === 0) return [];

    return this.db
      .select({
        seriesId: bookSeries.id,
        createdAt: bookSeries.createdAt,
        updatedAt: bookSeries.updatedAt,
        libraryId: sql<number | null>`min(${books.libraryId})`,
      })
      .from(bookSeries)
      .leftJoin(bookSeriesMemberships, eq(bookSeriesMemberships.seriesId, bookSeries.id))
      .leftJoin(books, eq(books.id, bookSeriesMemberships.bookId))
      .where(inArray(bookSeries.id, seriesIds))
      .groupBy(bookSeries.id);
  }

  async findSeriesName(seriesId: number): Promise<string | null> {
    const [row] = await this.db.select({ name: bookSeries.name }).from(bookSeries).where(eq(bookSeries.id, seriesId)).limit(1);
    return row?.name ?? null;
  }

  /**
   * The membership table is the authority on series identity; `book_metadata.series_id` is a
   * denormalized copy that the scanner does not always fill, and Komga clients break on an empty
   * `seriesId` (they request `/series/` with no id).
   */
  async findSeriesMembershipForBook(bookId: number): Promise<{ seriesId: number; seriesName: string; seriesIndex: string | null } | null> {
    const [row] = await this.db
      .select({ seriesId: bookSeries.id, seriesName: bookSeries.name, seriesIndex: bookSeriesMemberships.seriesIndex })
      .from(bookSeriesMemberships)
      .innerJoin(bookSeries, eq(bookSeries.id, bookSeriesMemberships.seriesId))
      .where(eq(bookSeriesMemberships.bookId, bookId))
      .orderBy(bookSeriesMemberships.displayOrder)
      .limit(1);

    return row ?? null;
  }

  async findSeriesIdsByCollections(collectionIds: number[]): Promise<{ collectionId: number; seriesId: number }[]> {
    if (collectionIds.length === 0) return [];

    return this.db
      .selectDistinct({ collectionId: collectionBooks.collectionId, seriesId: bookSeriesMemberships.seriesId })
      .from(collectionBooks)
      .innerJoin(bookSeriesMemberships, eq(bookSeriesMemberships.bookId, collectionBooks.bookId))
      .where(inArray(collectionBooks.collectionId, collectionIds));
  }

  async findReadableCollectionsForBook(userId: number, bookId: number): Promise<KomgaCollectionRow[]> {
    return this.db
      .select({
        id: collections.id,
        name: collections.name,
        description: collections.description,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
      })
      .from(collections)
      .innerJoin(collectionBooks, eq(collectionBooks.collectionId, collections.id))
      .where(and(eq(collectionBooks.bookId, bookId), or(eq(collections.userId, userId), eq(collections.isPublic, true))))
      .orderBy(collections.displayOrder, collections.name);
  }

  async findBookIdsByCollections(
    collectionIds: number[],
    libraryIds: number[],
    contentFilters?: ContentFilterRules,
  ): Promise<{ collectionId: number; bookId: number }[]> {
    if (collectionIds.length === 0 || libraryIds.length === 0) return [];

    const filterClauses = contentFilters ? buildContentFilterClauses(contentFilters, this.db) : [];

    return this.db
      .select({ collectionId: collectionBooks.collectionId, bookId: collectionBooks.bookId })
      .from(collectionBooks)
      .innerJoin(books, eq(books.id, collectionBooks.bookId))
      .innerJoin(bookMetadata, eq(bookMetadata.bookId, books.id))
      .where(
        and(
          inArray(collectionBooks.collectionId, collectionIds),
          inArray(books.libraryId, libraryIds),
          eq(books.status, 'present'),
          ...filterClauses,
        ),
      )
      .orderBy(collectionBooks.collectionId, collectionBooks.position);
  }

  async findSeriesNeighbours(params: {
    seriesId: number;
    bookId: number;
    libraryIds: number[];
    contentFilters?: ContentFilterRules;
  }): Promise<{ nextBookId: number | null; previousBookId: number | null }> {
    if (params.libraryIds.length === 0) return { nextBookId: null, previousBookId: null };

    const [current] = await this.db
      .select({ seriesIndex: bookSeriesMemberships.seriesIndex })
      .from(bookSeriesMemberships)
      .innerJoin(books, eq(books.id, bookSeriesMemberships.bookId))
      .where(
        and(
          eq(bookSeriesMemberships.seriesId, params.seriesId),
          eq(bookSeriesMemberships.bookId, params.bookId),
          inArray(books.libraryId, params.libraryIds),
        ),
      )
      .limit(1);

    if (!current) return { nextBookId: null, previousBookId: null };

    const filterClauses = params.contentFilters ? buildContentFilterClauses(params.contentFilters, this.db) : [];
    const baseWhere = and(
      eq(bookSeriesMemberships.seriesId, params.seriesId),
      eq(books.status, 'present'),
      inArray(books.libraryId, params.libraryIds),
      ...filterClauses,
    )!;

    const index = current.seriesIndex;
    const after =
      index === null
        ? and(isNull(bookSeriesMemberships.seriesIndex), gt(books.id, params.bookId))!
        : or(
            compareSeriesIndexSql(bookSeriesMemberships.seriesIndex, '>', index),
            and(compareSeriesIndexSql(bookSeriesMemberships.seriesIndex, '>=', index), gt(books.id, params.bookId)),
            isNull(bookSeriesMemberships.seriesIndex),
          )!;
    const before =
      index === null
        ? or(isNotNull(bookSeriesMemberships.seriesIndex), and(isNull(bookSeriesMemberships.seriesIndex), lt(books.id, params.bookId)))!
        : or(
            compareSeriesIndexSql(bookSeriesMemberships.seriesIndex, '<', index),
            and(compareSeriesIndexSql(bookSeriesMemberships.seriesIndex, '<=', index), lt(books.id, params.bookId)),
          )!;

    const [next, previous] = await Promise.all([
      this.findNeighbour(baseWhere, after, 'ASC', params.bookId),
      this.findNeighbour(baseWhere, before, 'DESC', params.bookId),
    ]);

    return { nextBookId: next, previousBookId: previous };
  }

  private async findNeighbour(baseWhere: SQL, bound: SQL, direction: 'ASC' | 'DESC', bookId: number): Promise<number | null> {
    const [row] = await this.db
      .select({ bookId: books.id })
      .from(books)
      .innerJoin(bookSeriesMemberships, eq(bookSeriesMemberships.bookId, books.id))
      .where(and(baseWhere, bound, ne(books.id, bookId)))
      .orderBy(...seriesIndexOrderBy(bookSeriesMemberships.seriesIndex, direction), asc(books.id))
      .limit(1);

    return row?.bookId ?? null;
  }

  async findSeriesDetailFact(params: {
    seriesId: number;
    userId: number;
    libraryIds: number[];
    contentFilters?: ContentFilterRules;
  }): Promise<KomgaSeriesDetailFact | null> {
    if (params.libraryIds.length === 0) return null;

    const filterClauses = params.contentFilters ? buildContentFilterClauses(params.contentFilters, this.db) : [];

    const [row] = await this.db
      .select({
        seriesId: bookSeries.id,
        name: bookSeries.name,
        expectedBookCount: bookSeries.expectedBookCount,
        createdAt: bookSeries.createdAt,
        updatedAt: bookSeries.updatedAt,
        libraryId: sql<number | null>`min(${books.libraryId})`,
        bookCount: sql<number>`count(distinct ${books.id})::int`,
        readCount: sql<number>`count(distinct CASE WHEN ${userBookStatus.status} = 'read' THEN ${books.id} END)::int`,
        readingCount: sql<number>`count(distinct CASE WHEN ${userBookStatus.status} = 'reading' THEN ${books.id} END)::int`,
      })
      .from(bookSeries)
      .innerJoin(bookSeriesMemberships, eq(bookSeriesMemberships.seriesId, bookSeries.id))
      .innerJoin(books, eq(books.id, bookSeriesMemberships.bookId))
      .innerJoin(bookMetadata, eq(bookMetadata.bookId, books.id))
      .leftJoin(userBookStatus, and(eq(userBookStatus.bookId, books.id), eq(userBookStatus.userId, params.userId)))
      .where(and(eq(bookSeries.id, params.seriesId), eq(books.status, 'present'), inArray(books.libraryId, params.libraryIds), ...filterClauses))
      .groupBy(bookSeries.id, bookSeries.name, bookSeries.expectedBookCount, bookSeries.createdAt, bookSeries.updatedAt);

    return row ?? null;
  }

  async findSeriesAuthors(params: { seriesId: number; libraryIds: number[]; contentFilters?: ContentFilterRules }): Promise<string[]> {
    if (params.libraryIds.length === 0) return [];

    const filterClauses = params.contentFilters ? buildContentFilterClauses(params.contentFilters, this.db) : [];

    const rows = await this.db
      .selectDistinct({ name: authors.name })
      .from(bookAuthors)
      .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
      .innerJoin(books, eq(books.id, bookAuthors.bookId))
      .innerJoin(bookSeriesMemberships, eq(bookSeriesMemberships.bookId, books.id))
      .where(
        and(
          eq(bookSeriesMemberships.seriesId, params.seriesId),
          eq(books.status, 'present'),
          inArray(books.libraryId, params.libraryIds),
          ...filterClauses,
        ),
      )
      .orderBy(authors.name);

    return rows.map((row) => row.name);
  }

  async findSeriesBookIds(params: { seriesId: number; libraryIds: number[]; contentFilters?: ContentFilterRules }): Promise<number[]> {
    if (params.libraryIds.length === 0) return [];

    const filterClauses = params.contentFilters ? buildContentFilterClauses(params.contentFilters, this.db) : [];

    const rows = await this.db
      .select({ bookId: books.id })
      .from(books)
      .innerJoin(bookSeriesMemberships, eq(bookSeriesMemberships.bookId, books.id))
      .innerJoin(bookMetadata, eq(bookMetadata.bookId, books.id))
      .where(
        and(
          eq(bookSeriesMemberships.seriesId, params.seriesId),
          eq(books.status, 'present'),
          inArray(books.libraryId, params.libraryIds),
          ...filterClauses,
        ),
      );

    return rows.map((row) => row.bookId);
  }

  async findReadableCollectionsForSeries(userId: number, seriesId: number): Promise<KomgaCollectionRow[]> {
    return this.db
      .selectDistinctOn([collections.id], {
        id: collections.id,
        name: collections.name,
        description: collections.description,
        createdAt: collections.createdAt,
        updatedAt: collections.updatedAt,
      })
      .from(collections)
      .innerJoin(collectionBooks, eq(collectionBooks.collectionId, collections.id))
      .innerJoin(bookSeriesMemberships, eq(bookSeriesMemberships.bookId, collectionBooks.bookId))
      .where(and(eq(bookSeriesMemberships.seriesId, seriesId), or(eq(collections.userId, userId), eq(collections.isPublic, true))))
      .orderBy(collections.id, collections.displayOrder, collections.name);
  }
}
