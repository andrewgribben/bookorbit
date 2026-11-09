import { Inject, Injectable } from '@nestjs/common';
import { and, inArray, or, type SQL, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { ReadingServiceProvider } from '@bookorbit/types';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import type { RemoteIndexBook } from './book-matcher';
import { ReadingServiceLibraryScopeService } from './reading-service-library-scope.service';

type Db = NodePgDatabase<typeof schema>;

/**
 * Bounded candidate lookup for matching a small batch of reading-service shelf items (friends,
 * trending, recommendations, owned-elsewhere, at most a few dozen per request) against the
 * user's own library. Scoped by the exact ISBN-13s and lowercased titles the batch asked for,
 * using `bm_title_lower_idx`, instead of paging the whole library the way a migration does:
 * shelves are read on every page load, so this has to stay cheap even for a tens-of-thousands-
 * book library.
 *
 * Shared by every provider adapter that needs local matching (Hardcover's own social shelves,
 * and `ReadingServicesController`'s generic server-side resolution for adapters, such as a
 * private one, that return `bookId: null` plus an `isbn`/title+author hint - see
 * docs/AGENT_HANDOFF.md's adapter contract section). Originally Hardcover-specific
 * (`HardcoverSocialMatchRepository`), generalised here so it has exactly one implementation.
 */
@Injectable()
export class ReadingServiceMatchRepository {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly libraryScopeService: ReadingServiceLibraryScopeService,
  ) {}

  async findCandidates(userId: number, provider: ReadingServiceProvider, isbn13s: string[], titlesLower: string[]): Promise<RemoteIndexBook[]> {
    if (isbn13s.length === 0 && titlesLower.length === 0) return [];

    // Enabled-only (no specific feature): this is shared local matching for several shelf kinds
    // (friends/trending/recommendations/owned-elsewhere and generic adapter fallback matching),
    // so it only honours the library on/off switch, not a per-feature override.
    const libraryIds = await this.libraryScopeService.getEffectiveLibraryIdsForUserId(userId, provider, null);
    if (libraryIds.length === 0) return [];

    const matchConditions: SQL[] = [];
    if (isbn13s.length > 0) matchConditions.push(inArray(schema.bookMetadata.isbn13, isbn13s));
    if (titlesLower.length > 0) matchConditions.push(inArray(sql`lower(${schema.bookMetadata.title})`, titlesLower));
    if (matchConditions.length === 0) return [];

    const rows = await this.db
      .select({
        bookId: schema.books.id,
        isbn13: schema.bookMetadata.isbn13,
        isbn10: schema.bookMetadata.isbn10,
        title: schema.bookMetadata.title,
        authorsCsv: sql<string>`coalesce(string_agg(${schema.authors.name}, '||' order by ${schema.bookAuthors.displayOrder}, ${schema.bookAuthors.authorId}), '')`,
      })
      .from(schema.books)
      .innerJoin(schema.bookMetadata, sql`${schema.bookMetadata.bookId} = ${schema.books.id}`)
      .leftJoin(schema.bookAuthors, sql`${schema.bookAuthors.bookId} = ${schema.books.id}`)
      .leftJoin(schema.authors, sql`${schema.authors.id} = ${schema.bookAuthors.authorId}`)
      .where(and(inArray(schema.books.libraryId, libraryIds), or(...matchConditions)))
      .groupBy(schema.books.id, schema.bookMetadata.isbn13, schema.bookMetadata.isbn10, schema.bookMetadata.title);

    return rows.map((row) => ({
      externalId: String(row.bookId),
      isbn13: row.isbn13,
      isbn10: row.isbn10,
      title: row.title,
      author: row.authorsCsv
        ? row.authorsCsv
            .split('||')
            .filter((a: string) => a.length > 0)
            .join(', ')
        : null,
    }));
  }
}
