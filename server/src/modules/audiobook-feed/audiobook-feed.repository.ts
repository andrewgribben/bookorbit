import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AUDIO_FORMAT_LIST } from '@bookorbit/types';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import { audiobookPodcastFeeds, bookAuthors, bookFiles, bookMetadata, books, authors } from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class AudiobookFeedRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  findByPublicId(publicId: string) {
    return this.db.select().from(audiobookPodcastFeeds).where(eq(audiobookPodcastFeeds.publicId, publicId)).limit(1);
  }

  findByBookId(bookId: number) {
    return this.db.select().from(audiobookPodcastFeeds).where(eq(audiobookPodcastFeeds.bookId, bookId)).limit(1);
  }

  findByBookIds(bookIds: number[]) {
    if (bookIds.length === 0) return Promise.resolve([]);
    return this.db.select().from(audiobookPodcastFeeds).where(inArray(audiobookPodcastFeeds.bookId, bookIds));
  }

  async upsertEnabled(bookId: number, userId: number) {
    const [existing] = await this.findByBookId(bookId);
    if (existing) {
      const [row] = await this.db
        .update(audiobookPodcastFeeds)
        .set({ enabled: true, updatedAt: new Date() })
        .where(eq(audiobookPodcastFeeds.bookId, bookId))
        .returning();
      return row!;
    }
    const [row] = await this.db.insert(audiobookPodcastFeeds).values({ bookId, createdByUserId: userId, enabled: true }).returning();
    return row!;
  }

  async setEnabled(bookId: number, enabled: boolean) {
    const [row] = await this.db
      .update(audiobookPodcastFeeds)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(audiobookPodcastFeeds.bookId, bookId))
      .returning();
    return row ?? null;
  }

  async listCatalog(libraryIds: number[], query: string | undefined, limit: number, offset: number) {
    if (libraryIds.length === 0) return { rows: [], total: 0 };

    const audioFormats = AUDIO_FORMAT_LIST.map((format) => format.toLowerCase());
    const search = query?.trim();
    const searchClause =
      search && search.length > 0 ? or(ilike(bookMetadata.title, `%${search}%`), ilike(books.folderPath, `%${search}%`)) : undefined;

    const baseWhere = and(
      inArray(books.libraryId, libraryIds),
      eq(books.status, 'present'),
      sql`exists (
        select 1 from ${bookFiles}
        where ${bookFiles.bookId} = ${books.id}
          and ${bookFiles.role} = 'content'
          and lower(${bookFiles.format}) in (${sql.join(
            audioFormats.map((format) => sql`${format}`),
            sql`, `,
          )})
      )`,
      searchClause,
    );

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(books)
      .leftJoin(bookMetadata, eq(bookMetadata.bookId, books.id))
      .where(baseWhere);

    const rows = await this.db
      .select({
        bookId: books.id,
        libraryId: books.libraryId,
        folderPath: books.folderPath,
        title: bookMetadata.title,
        description: bookMetadata.description,
        addedAt: books.addedAt,
        feedPublicId: audiobookPodcastFeeds.publicId,
        feedEnabled: audiobookPodcastFeeds.enabled,
      })
      .from(books)
      .leftJoin(bookMetadata, eq(bookMetadata.bookId, books.id))
      .leftJoin(audiobookPodcastFeeds, eq(audiobookPodcastFeeds.bookId, books.id))
      .where(baseWhere)
      .orderBy(asc(sql`coalesce(${bookMetadata.title}, ${books.folderPath})`), asc(books.id))
      .limit(limit)
      .offset(offset);

    return { rows, total: countRow?.count ?? 0 };
  }

  async findAuthorsByBookIds(bookIds: number[]) {
    if (bookIds.length === 0) return [];
    return this.db
      .select({
        bookId: bookAuthors.bookId,
        name: authors.name,
        displayOrder: bookAuthors.displayOrder,
      })
      .from(bookAuthors)
      .innerJoin(authors, eq(authors.id, bookAuthors.authorId))
      .where(inArray(bookAuthors.bookId, bookIds))
      .orderBy(asc(bookAuthors.displayOrder), asc(authors.name));
  }

  async findAudioContentFiles(bookId: number) {
    return this.db
      .select({
        id: bookFiles.id,
        publicId: bookFiles.publicId,
        absolutePath: bookFiles.absolutePath,
        format: bookFiles.format,
        sizeBytes: bookFiles.sizeBytes,
        durationSeconds: bookFiles.durationSeconds,
        sortOrder: bookFiles.sortOrder,
        createdAt: bookFiles.createdAt,
      })
      .from(bookFiles)
      .where(and(eq(bookFiles.bookId, bookId), eq(bookFiles.role, 'content')))
      .orderBy(asc(bookFiles.sortOrder), asc(bookFiles.absolutePath), asc(bookFiles.id));
  }

  async findAudioContentFile(bookId: number, filePublicId: string) {
    const [row] = await this.db
      .select({
        id: bookFiles.id,
        publicId: bookFiles.publicId,
        absolutePath: bookFiles.absolutePath,
        format: bookFiles.format,
        sizeBytes: bookFiles.sizeBytes,
        durationSeconds: bookFiles.durationSeconds,
      })
      .from(bookFiles)
      .where(and(eq(bookFiles.bookId, bookId), eq(bookFiles.publicId, filePublicId), eq(bookFiles.role, 'content')))
      .limit(1);
    return row ?? null;
  }

  async findBookSummary(bookId: number) {
    const [row] = await this.db
      .select({
        id: books.id,
        libraryId: books.libraryId,
        folderPath: books.folderPath,
        addedAt: books.addedAt,
        title: bookMetadata.title,
        description: bookMetadata.description,
      })
      .from(books)
      .leftJoin(bookMetadata, eq(bookMetadata.bookId, books.id))
      .where(eq(books.id, bookId))
      .limit(1);
    return row ?? null;
  }
}
