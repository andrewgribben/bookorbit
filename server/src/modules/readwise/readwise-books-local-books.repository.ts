import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ReadStatus } from '@bookorbit/types';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import type { RequestUser } from '../../common/types/request-user';
import { ReadingServiceLibraryScopeService } from '../reading-services/reading-service-library-scope.service';

type Db = NodePgDatabase<typeof schema>;

export interface LocalBookForMigration {
  bookId: number;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  author: string | null;
  status: ReadStatus;
  rating: number | null;
  review: string | null;
  startedAt: string | null; // ISO datetime, from the latest reading attempt
  finishedAt: string | null; // ISO datetime, from the latest reading attempt
}

function toIsoMidnight(dateOnly: string | null): string | null {
  return dateOnly ? `${dateOnly}T00:00:00Z` : null;
}

@Injectable()
export class ReadwiseBooksLocalBooksRepository {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly libraryScopeService: ReadingServiceLibraryScopeService,
  ) {}

  /**
   * Resolves the accessible libraries for a user from only their id, intersected with the
   * Readwise library scope (owner decision: push/pull/migration/owned-elsewhere all read through
   * `findOne`/`findPage` below, so scoping it here is the one change that gates all of them).
   * Enabled-only (no specific feature): status/rating/review/dates push as one bundle today, so
   * a per-library per-feature override on one of those fields isn't honoured at this level yet
   * (see docs/AGENT_HANDOFF.md's open-questions note).
   */
  private async accessibleLibraryIds(userId: number): Promise<number[]> {
    const pseudoUser = await this.resolveUser(userId);
    return this.libraryScopeService.getEffectiveLibraryIds(pseudoUser, 'readwise', null);
  }

  /**
   * Builds a minimal `RequestUser` from only an id, for background jobs (push/pull) that call
   * into `BookService`/library-scoped services outside an HTTP request context.
   */
  async resolveUser(userId: number): Promise<RequestUser> {
    const [user] = await this.db.select({ isSuperuser: schema.users.isSuperuser }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    return { id: userId, isSuperuser: user?.isSuperuser ?? false } as RequestUser;
  }

  /** Single-book lookup for the push/pull flows, which already know the bookId from a link or event. */
  async findOne(userId: number, bookId: number): Promise<LocalBookForMigration | null> {
    const libraryIds = await this.accessibleLibraryIds(userId);
    if (libraryIds.length === 0) return null;

    const rows = await this.db
      .select({
        bookId: schema.books.id,
        isbn13: schema.bookMetadata.isbn13,
        isbn10: schema.bookMetadata.isbn10,
        title: schema.bookMetadata.title,
        status: schema.userBookStatus.status,
        rating: schema.userBookRatings.rating,
        review: schema.userBookReviews.review,
        authorsCsv: sql<string>`coalesce(string_agg(${schema.authors.name}, '||' order by ${schema.bookAuthors.displayOrder}, ${schema.bookAuthors.authorId}), '')`,
      })
      .from(schema.books)
      .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id))
      .leftJoin(schema.userBookStatus, and(eq(schema.userBookStatus.bookId, schema.books.id), eq(schema.userBookStatus.userId, userId)))
      .leftJoin(schema.userBookRatings, and(eq(schema.userBookRatings.bookId, schema.books.id), eq(schema.userBookRatings.userId, userId)))
      .leftJoin(schema.userBookReviews, and(eq(schema.userBookReviews.bookId, schema.books.id), eq(schema.userBookReviews.userId, userId)))
      .leftJoin(schema.bookAuthors, eq(schema.bookAuthors.bookId, schema.books.id))
      .leftJoin(schema.authors, eq(schema.authors.id, schema.bookAuthors.authorId))
      .where(and(inArray(schema.books.libraryId, libraryIds), eq(schema.books.id, bookId)))
      .groupBy(
        schema.books.id,
        schema.bookMetadata.isbn13,
        schema.bookMetadata.isbn10,
        schema.bookMetadata.title,
        schema.userBookStatus.status,
        schema.userBookRatings.rating,
        schema.userBookReviews.review,
      )
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const [attempt] = await this.db
      .select({ startedOn: schema.readingAttempts.startedOn, endedOn: schema.readingAttempts.endedOn })
      .from(schema.readingAttempts)
      .where(and(eq(schema.readingAttempts.userId, userId), eq(schema.readingAttempts.bookId, bookId), isNull(schema.readingAttempts.deletedAt)))
      .orderBy(asc(schema.readingAttempts.id));

    return {
      bookId: row.bookId,
      isbn13: row.isbn13,
      isbn10: row.isbn10,
      title: row.title ?? '',
      author: row.authorsCsv
        ? row.authorsCsv
            .split('||')
            .filter((a: string) => a.length > 0)
            .join(', ')
        : null,
      status: (row.status as ReadStatus) ?? 'unread',
      rating: row.rating ?? null,
      review: row.review ?? null,
      startedAt: toIsoMidnight(attempt?.startedOn ?? null),
      finishedAt: toIsoMidnight(attempt?.endedOn ?? null),
    };
  }

  async findPage(userId: number, afterBookId: number, limit: number): Promise<LocalBookForMigration[]> {
    const libraryIds = await this.accessibleLibraryIds(userId);
    if (libraryIds.length === 0) return [];

    const rows = await this.db
      .select({
        bookId: schema.books.id,
        isbn13: schema.bookMetadata.isbn13,
        isbn10: schema.bookMetadata.isbn10,
        title: schema.bookMetadata.title,
        status: schema.userBookStatus.status,
        rating: schema.userBookRatings.rating,
        review: schema.userBookReviews.review,
        authorsCsv: sql<string>`coalesce(string_agg(${schema.authors.name}, '||' order by ${schema.bookAuthors.displayOrder}, ${schema.bookAuthors.authorId}), '')`,
      })
      .from(schema.books)
      .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id))
      .leftJoin(schema.userBookStatus, and(eq(schema.userBookStatus.bookId, schema.books.id), eq(schema.userBookStatus.userId, userId)))
      .leftJoin(schema.userBookRatings, and(eq(schema.userBookRatings.bookId, schema.books.id), eq(schema.userBookRatings.userId, userId)))
      .leftJoin(schema.userBookReviews, and(eq(schema.userBookReviews.bookId, schema.books.id), eq(schema.userBookReviews.userId, userId)))
      .leftJoin(schema.bookAuthors, eq(schema.bookAuthors.bookId, schema.books.id))
      .leftJoin(schema.authors, eq(schema.authors.id, schema.bookAuthors.authorId))
      .where(and(inArray(schema.books.libraryId, libraryIds), gt(schema.books.id, afterBookId)))
      .groupBy(
        schema.books.id,
        schema.bookMetadata.isbn13,
        schema.bookMetadata.isbn10,
        schema.bookMetadata.title,
        schema.userBookStatus.status,
        schema.userBookRatings.rating,
        schema.userBookReviews.review,
      )
      .orderBy(asc(schema.books.id))
      .limit(limit);

    if (rows.length === 0) return [];

    const bookIds = rows.map((r) => r.bookId);
    const attempts = await this.db
      .select({ bookId: schema.readingAttempts.bookId, startedOn: schema.readingAttempts.startedOn, endedOn: schema.readingAttempts.endedOn })
      .from(schema.readingAttempts)
      .where(
        and(eq(schema.readingAttempts.userId, userId), inArray(schema.readingAttempts.bookId, bookIds), isNull(schema.readingAttempts.deletedAt)),
      )
      .orderBy(asc(schema.readingAttempts.id));

    const latestByBook = new Map<number, { startedOn: string | null; endedOn: string | null }>();
    for (const attempt of attempts) {
      if (attempt.bookId === null) continue;
      latestByBook.set(attempt.bookId, { startedOn: attempt.startedOn, endedOn: attempt.endedOn });
    }

    return rows.map((r) => {
      const latest = latestByBook.get(r.bookId);
      return {
        bookId: r.bookId,
        isbn13: r.isbn13,
        isbn10: r.isbn10,
        title: r.title ?? '',
        author: r.authorsCsv
          ? r.authorsCsv
              .split('||')
              .filter((a: string) => a.length > 0)
              .join(', ')
          : null,
        status: (r.status as ReadStatus) ?? 'unread',
        rating: r.rating ?? null,
        review: r.review ?? null,
        startedAt: toIsoMidnight(latest?.startedOn ?? null),
        finishedAt: toIsoMidnight(latest?.endedOn ?? null),
      };
    });
  }
}
