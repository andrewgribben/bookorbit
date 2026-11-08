import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ReadStatus } from '@bookorbit/types';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import { LibraryService } from '../library/library.service';
import type { RequestUser } from '../../common/types/request-user';

type Db = NodePgDatabase<typeof schema>;

export interface LocalBookForMigration {
  bookId: number;
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  author: string | null;
  status: ReadStatus;
  rating: number | null;
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
    private readonly libraryService: LibraryService,
  ) {}

  /** Resolves the accessible libraries for a user from only their id, for adapters that only get a userId. */
  private async accessibleLibraryIds(userId: number): Promise<number[]> {
    const [user] = await this.db.select({ isSuperuser: schema.users.isSuperuser }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const pseudoUser = { id: userId, isSuperuser: user?.isSuperuser ?? false } as RequestUser;
    return this.libraryService.findAccessibleLibraryIds(pseudoUser);
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
        authorsCsv: sql<string>`coalesce(string_agg(${schema.authors.name}, '||' order by ${schema.bookAuthors.displayOrder}, ${schema.bookAuthors.authorId}), '')`,
      })
      .from(schema.books)
      .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.books.id))
      .leftJoin(schema.userBookStatus, and(eq(schema.userBookStatus.bookId, schema.books.id), eq(schema.userBookStatus.userId, userId)))
      .leftJoin(schema.userBookRatings, and(eq(schema.userBookRatings.bookId, schema.books.id), eq(schema.userBookRatings.userId, userId)))
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
        startedAt: toIsoMidnight(latest?.startedOn ?? null),
        finishedAt: toIsoMidnight(latest?.endedOn ?? null),
      };
    });
  }
}
