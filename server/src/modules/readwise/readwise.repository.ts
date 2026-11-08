import { Inject, Injectable } from '@nestjs/common';
import { Permission } from '@bookorbit/types';
import { and, asc, eq, gt, inArray, isNotNull, isNull, ne, notInArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import type { NewReadwiseUserSetting, ReadwiseUserSetting } from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

export interface NewHighlightRow {
  annotationId: number;
  bookId: number;
  text: string;
  note: string | null;
  createdAt: Date;
  title: string | null;
  author: string; // joined, may be ''
  isbn13: string | null;
  isbn10: string | null;
}

export interface LinkedHighlightRow extends NewHighlightRow {
  externalId: string;
  contentHash: string | null;
}

export interface DeletedLinkedHighlightRow {
  annotationId: number;
  externalId: string;
}

@Injectable()
export class ReadwiseRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findSettings(userId: number): Promise<ReadwiseUserSetting | undefined> {
    return this.db.query.readwiseUserSettings.findFirst({
      where: eq(schema.readwiseUserSettings.userId, userId),
    });
  }

  /** Users with Readwise enabled and a token configured, for the books pull interval job. */
  async findConnectedUserIds(): Promise<number[]> {
    const rows = await this.db
      .select({ userId: schema.readwiseUserSettings.userId })
      .from(schema.readwiseUserSettings)
      .where(
        and(
          eq(schema.readwiseUserSettings.enabled, true),
          isNull(schema.readwiseUserSettings.disabledReason),
          sql`(${schema.readwiseUserSettings.apiToken} is not null or ${schema.readwiseUserSettings.apiTokenEncrypted} is not null)`,
        ),
      );
    return rows.map((r) => r.userId);
  }

  async findLatestAnnotationId(userId: number): Promise<number> {
    const [row] = await this.db
      .select({ latestAnnotationId: sql<number>`coalesce(max(${schema.annotations.id}), 0)::int` })
      .from(schema.annotations)
      .where(eq(schema.annotations.userId, userId))
      .limit(1);

    return row?.latestAnnotationId ?? 0;
  }

  async upsertSettings(
    userId: number,
    data: Partial<Omit<ReadwiseUserSetting, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  ): Promise<ReadwiseUserSetting> {
    const [row] = await this.db
      .insert(schema.readwiseUserSettings)
      .values({ userId, ...data } as NewReadwiseUserSetting)
      .onConflictDoUpdate({
        target: schema.readwiseUserSettings.userId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return row!;
  }

  async userHasReadwiseSyncPermission(userId: number): Promise<boolean> {
    const [row] = await this.db
      .select({
        isSuperuser: schema.users.isSuperuser,
        permissionName: schema.userPermissions.permissionName,
      })
      .from(schema.users)
      .leftJoin(
        schema.userPermissions,
        and(eq(schema.userPermissions.userId, schema.users.id), eq(schema.userPermissions.permissionName, Permission.ReadwiseSync)),
      )
      .where(and(eq(schema.users.id, userId), eq(schema.users.active, true)))
      .limit(1);
    return row?.isSuperuser === true || row?.permissionName === Permission.ReadwiseSync;
  }

  async findNewHighlights(userId: number, afterId: number, limit: number): Promise<NewHighlightRow[]> {
    const rows = await this.selectHighlightRows(and(gt(schema.annotations.id, afterId)), userId, limit);
    return rows.map((r) => this.toHighlightRow(r));
  }

  /**
   * S5 ledger-based create query: annotations not yet in `reading_service_item_links`
   * (kind='highlight'), replacing the watermark (`lastSyncedAnnotationId`) this used to read.
   * The watermark column is kept on the schema for upstream compatibility but is no longer read.
   */
  async findPushableHighlights(userId: number, limit: number): Promise<NewHighlightRow[]> {
    const linked = this.db
      .select({ localId: schema.readingServiceItemLinks.localId })
      .from(schema.readingServiceItemLinks)
      .where(
        and(
          eq(schema.readingServiceItemLinks.userId, userId),
          eq(schema.readingServiceItemLinks.provider, 'readwise'),
          eq(schema.readingServiceItemLinks.kind, 'highlight'),
        ),
      );
    const rows = await this.selectHighlightRows(notInArray(schema.annotations.id, linked), userId, limit);
    return rows.map((r) => this.toHighlightRow(r));
  }

  /**
   * Linked highlights whose current text/note no longer matches the content hash recorded at
   * last sync - a local edit the push side needs to PATCH to Readwise.
   */
  async findChangedLinkedHighlights(userId: number, afterAnnotationId: number, limit: number): Promise<LinkedHighlightRow[]> {
    const rows = await this.db
      .select({
        annotationId: schema.annotations.id,
        bookId: schema.annotations.bookId,
        text: schema.annotations.text,
        note: schema.annotations.note,
        createdAt: schema.annotations.createdAt,
        title: schema.bookMetadata.title,
        isbn13: schema.bookMetadata.isbn13,
        isbn10: schema.bookMetadata.isbn10,
        externalId: schema.readingServiceItemLinks.externalId,
        contentHash: schema.readingServiceItemLinks.contentHash,
        authorsCsv: sql<string>`coalesce(string_agg(${schema.authors.name}, '||' order by ${schema.bookAuthors.displayOrder}, ${schema.bookAuthors.authorId}), '')`,
      })
      .from(schema.readingServiceItemLinks)
      .innerJoin(schema.annotations, eq(schema.annotations.id, schema.readingServiceItemLinks.localId))
      .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.annotations.bookId))
      .leftJoin(schema.bookAuthors, eq(schema.bookAuthors.bookId, schema.annotations.bookId))
      .leftJoin(schema.authors, eq(schema.authors.id, schema.bookAuthors.authorId))
      .where(
        and(
          eq(schema.readingServiceItemLinks.userId, userId),
          eq(schema.readingServiceItemLinks.provider, 'readwise'),
          eq(schema.readingServiceItemLinks.kind, 'highlight'),
          isNull(schema.readingServiceItemLinks.deletedAt),
          isNull(schema.annotations.deletedAt),
          gt(schema.annotations.id, afterAnnotationId),
        ),
      )
      .groupBy(
        schema.annotations.id,
        schema.annotations.bookId,
        schema.annotations.text,
        schema.annotations.note,
        schema.annotations.createdAt,
        schema.bookMetadata.title,
        schema.bookMetadata.isbn13,
        schema.bookMetadata.isbn10,
        schema.readingServiceItemLinks.externalId,
        schema.readingServiceItemLinks.contentHash,
      )
      .orderBy(asc(schema.annotations.id))
      .limit(limit);

    return rows.map((r) => ({ ...this.toHighlightRow(r), externalId: r.externalId, contentHash: r.contentHash }));
  }

  /** Ledger-linked highlights whose local annotation was soft-deleted but the ledger isn't yet; the delete push target. */
  async findDeletedLinkedHighlights(userId: number, limit: number): Promise<DeletedLinkedHighlightRow[]> {
    const rows = await this.db
      .select({
        annotationId: schema.annotations.id,
        externalId: schema.readingServiceItemLinks.externalId,
      })
      .from(schema.readingServiceItemLinks)
      .innerJoin(schema.annotations, eq(schema.annotations.id, schema.readingServiceItemLinks.localId))
      .where(
        and(
          eq(schema.readingServiceItemLinks.userId, userId),
          eq(schema.readingServiceItemLinks.provider, 'readwise'),
          eq(schema.readingServiceItemLinks.kind, 'highlight'),
          isNull(schema.readingServiceItemLinks.deletedAt),
          isNotNull(schema.annotations.deletedAt),
        ),
      )
      .limit(limit);
    return rows;
  }

  /** Annotations by id, for the ledger backfill text/location match and the pull apply path. */
  async findAnnotationsByIds(userId: number, annotationIds: number[]): Promise<{ id: number; bookId: number; text: string }[]> {
    if (annotationIds.length === 0) return [];
    return this.db
      .select({ id: schema.annotations.id, bookId: schema.annotations.bookId, text: schema.annotations.text })
      .from(schema.annotations)
      .where(and(eq(schema.annotations.userId, userId), inArray(schema.annotations.id, annotationIds)));
  }

  private selectHighlightRows(extraWhere: ReturnType<typeof and>, userId: number, limit: number) {
    return this.db
      .select({
        annotationId: schema.annotations.id,
        bookId: schema.annotations.bookId,
        text: schema.annotations.text,
        note: schema.annotations.note,
        createdAt: schema.annotations.createdAt,
        title: schema.bookMetadata.title,
        isbn13: schema.bookMetadata.isbn13,
        isbn10: schema.bookMetadata.isbn10,
        authorsCsv: sql<string>`coalesce(string_agg(${schema.authors.name}, '||' order by ${schema.bookAuthors.displayOrder}, ${schema.bookAuthors.authorId}), '')`,
      })
      .from(schema.annotations)
      .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.annotations.bookId))
      .leftJoin(schema.bookAuthors, eq(schema.bookAuthors.bookId, schema.annotations.bookId))
      .leftJoin(schema.authors, eq(schema.authors.id, schema.bookAuthors.authorId))
      .where(
        and(eq(schema.annotations.userId, userId), ne(schema.annotations.text, ''), isNull(schema.annotations.deletedAt), extraWhere),
      )
      .groupBy(
        schema.annotations.id,
        schema.annotations.bookId,
        schema.annotations.text,
        schema.annotations.note,
        schema.annotations.createdAt,
        schema.bookMetadata.title,
        schema.bookMetadata.isbn13,
        schema.bookMetadata.isbn10,
      )
      .orderBy(asc(schema.annotations.id))
      .limit(limit);
  }

  private toHighlightRow(r: {
    annotationId: number;
    bookId: number;
    text: string;
    note: string | null;
    createdAt: Date;
    title: string | null;
    isbn13: string | null;
    isbn10: string | null;
    authorsCsv: string;
  }): NewHighlightRow {
    return {
      annotationId: r.annotationId,
      bookId: r.bookId,
      text: r.text,
      note: r.note,
      createdAt: r.createdAt,
      title: r.title,
      isbn13: r.isbn13,
      isbn10: r.isbn10,
      author: r.authorsCsv
        ? r.authorsCsv
            .split('||')
            .filter((a) => a.length > 0)
            .join(', ')
        : '',
    };
  }
}
