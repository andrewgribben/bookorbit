import { Inject, Injectable } from '@nestjs/common';
import { Permission } from '@bookorbit/types';
import { and, asc, eq, gt, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import type { NewTkSyncItem, NewTkUserSetting, TkSyncItemRow, TkUserSetting } from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

export interface TkPendingAnnotationRow {
  annotationId: number;
  bookId: number;
  bookTitle: string | null;
  bookAuthor: string;
  text: string;
  note: string | null;
  createdAt: Date;
}

export interface TkPendingJournalRow {
  clientId: string;
  bookId: number;
  bookTitle: string | null;
  bookAuthor: string;
  body: string;
  quote: string | null;
  createdAt: Date;
}

export interface TkPendingFinishedRow {
  bookId: number;
  bookTitle: string | null;
  bookAuthor: string;
  finishedAt: Date;
  rating: number | null;
}

export interface TkLedgerInsert {
  kind: 'annotation' | 'journal' | 'finished';
  sourceKey: string;
  dateKey: string;
  tkDocumentId: string;
}

export interface TkWatermarkUpdate {
  lastAnnotationId?: number;
  lastJournalCreatedAt?: Date;
  lastFinishedAt?: Date;
  lastSyncedAt?: Date;
}

@Injectable()
export class TkRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findSettings(userId: number): Promise<TkUserSetting | undefined> {
    return this.db.query.tkUserSettings.findFirst({ where: eq(schema.tkUserSettings.userId, userId) });
  }

  async upsertSettings(userId: number, data: Partial<Omit<TkUserSetting, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<TkUserSetting> {
    const [row] = await this.db
      .insert(schema.tkUserSettings)
      .values({ userId, ...data } as NewTkUserSetting)
      .onConflictDoUpdate({ target: schema.tkUserSettings.userId, set: { ...data, updatedAt: new Date() } })
      .returning();
    return row!;
  }

  async userHasTkSyncPermission(userId: number): Promise<boolean> {
    const [row] = await this.db
      .select({ isSuperuser: schema.users.isSuperuser, permissionName: schema.userPermissions.permissionName })
      .from(schema.users)
      .leftJoin(
        schema.userPermissions,
        and(eq(schema.userPermissions.userId, schema.users.id), eq(schema.userPermissions.permissionName, Permission.TkSync)),
      )
      .where(and(eq(schema.users.id, userId), eq(schema.users.active, true)))
      .limit(1);
    return row?.isSuperuser === true || row?.permissionName === Permission.TkSync;
  }

  async findUserTimezone(userId: number): Promise<unknown> {
    const [row] = await this.db.select({ settings: schema.users.settings }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    return (row?.settings as { timezone?: unknown } | null)?.timezone;
  }

  async findPendingAnnotations(userId: number, afterId: number, limit: number): Promise<TkPendingAnnotationRow[]> {
    const rows = await this.db
      .select({
        annotationId: schema.annotations.id,
        bookId: schema.annotations.bookId,
        text: schema.annotations.text,
        note: schema.annotations.note,
        createdAt: schema.annotations.createdAt,
        bookTitle: schema.bookMetadata.title,
        authorsCsv: sql<string>`coalesce(string_agg(${schema.authors.name}, '||' order by ${schema.bookAuthors.displayOrder}, ${schema.bookAuthors.authorId}), '')`,
      })
      .from(schema.annotations)
      .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.annotations.bookId))
      .leftJoin(schema.bookAuthors, eq(schema.bookAuthors.bookId, schema.annotations.bookId))
      .leftJoin(schema.authors, eq(schema.authors.id, schema.bookAuthors.authorId))
      .where(
        and(
          eq(schema.annotations.userId, userId),
          gt(schema.annotations.id, afterId),
          isNull(schema.annotations.deletedAt),
          sql`(${schema.annotations.text} <> '' or coalesce(${schema.annotations.note}, '') <> '')`,
        ),
      )
      .groupBy(
        schema.annotations.id,
        schema.annotations.bookId,
        schema.annotations.text,
        schema.annotations.note,
        schema.annotations.createdAt,
        schema.bookMetadata.title,
      )
      .orderBy(asc(schema.annotations.id))
      .limit(limit);

    return rows.map((r) => ({ ...r, bookAuthor: formatAuthors(r.authorsCsv) }));
  }

  async findPendingJournalEntries(userId: number, afterCreatedAt: Date | null, limit: number): Promise<TkPendingJournalRow[]> {
    const rows = await this.db
      .select({
        clientId: schema.bookJournalEntries.clientId,
        bookId: schema.bookJournalEntries.bookId,
        body: schema.bookJournalEntries.body,
        quote: schema.bookJournalEntries.quote,
        createdAt: schema.bookJournalEntries.createdAt,
        bookTitle: schema.bookMetadata.title,
        authorsCsv: sql<string>`coalesce(string_agg(${schema.authors.name}, '||' order by ${schema.bookAuthors.displayOrder}, ${schema.bookAuthors.authorId}), '')`,
      })
      .from(schema.bookJournalEntries)
      .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.bookJournalEntries.bookId))
      .leftJoin(schema.bookAuthors, eq(schema.bookAuthors.bookId, schema.bookJournalEntries.bookId))
      .leftJoin(schema.authors, eq(schema.authors.id, schema.bookAuthors.authorId))
      .where(
        and(
          eq(schema.bookJournalEntries.userId, userId),
          isNull(schema.bookJournalEntries.deletedAt),
          afterCreatedAt ? gt(schema.bookJournalEntries.createdAt, afterCreatedAt) : undefined,
        ),
      )
      .groupBy(
        schema.bookJournalEntries.id,
        schema.bookJournalEntries.clientId,
        schema.bookJournalEntries.bookId,
        schema.bookJournalEntries.body,
        schema.bookJournalEntries.quote,
        schema.bookJournalEntries.createdAt,
        schema.bookMetadata.title,
      )
      .orderBy(asc(schema.bookJournalEntries.createdAt))
      .limit(limit);

    return rows.map((r) => ({ ...r, bookAuthor: formatAuthors(r.authorsCsv) }));
  }

  async findPendingFinishedBooks(userId: number, afterFinishedAt: Date | null, limit: number): Promise<TkPendingFinishedRow[]> {
    const rows = await this.db
      .select({
        bookId: schema.userBookStatus.bookId,
        finishedAt: schema.userBookStatus.finishedAt,
        rating: schema.userBookRatings.rating,
        bookTitle: schema.bookMetadata.title,
        authorsCsv: sql<string>`coalesce(string_agg(${schema.authors.name}, '||' order by ${schema.bookAuthors.displayOrder}, ${schema.bookAuthors.authorId}), '')`,
      })
      .from(schema.userBookStatus)
      .leftJoin(schema.bookMetadata, eq(schema.bookMetadata.bookId, schema.userBookStatus.bookId))
      .leftJoin(schema.bookAuthors, eq(schema.bookAuthors.bookId, schema.userBookStatus.bookId))
      .leftJoin(schema.authors, eq(schema.authors.id, schema.bookAuthors.authorId))
      .leftJoin(
        schema.userBookRatings,
        and(eq(schema.userBookRatings.bookId, schema.userBookStatus.bookId), eq(schema.userBookRatings.userId, schema.userBookStatus.userId)),
      )
      .where(
        and(
          eq(schema.userBookStatus.userId, userId),
          eq(schema.userBookStatus.status, 'read'),
          isNotNull(schema.userBookStatus.finishedAt),
          afterFinishedAt ? gt(schema.userBookStatus.finishedAt, afterFinishedAt) : undefined,
        ),
      )
      .groupBy(schema.userBookStatus.bookId, schema.userBookStatus.finishedAt, schema.userBookRatings.rating, schema.bookMetadata.title)
      .orderBy(asc(schema.userBookStatus.finishedAt))
      .limit(limit);

    return rows.map((r) => ({ ...r, finishedAt: r.finishedAt!, bookAuthor: formatAuthors(r.authorsCsv) }));
  }

  /** Already-ledgered source keys for `kind`, used to drop items a previous flush already wrote. */
  async findSyncedSourceKeys(userId: number, kind: 'annotation' | 'journal' | 'finished', sourceKeys: string[]): Promise<Set<string>> {
    if (sourceKeys.length === 0) return new Set();
    const rows = await this.db
      .select({ sourceKey: schema.tkSyncItems.sourceKey })
      .from(schema.tkSyncItems)
      .where(and(eq(schema.tkSyncItems.userId, userId), eq(schema.tkSyncItems.kind, kind), inArray(schema.tkSyncItems.sourceKey, sourceKeys)));
    return new Set(rows.map((r) => r.sourceKey));
  }

  /** Inserts ledger rows and advances watermarks atomically, so a crash mid-flush cannot record one without the other. */
  async recordSyncedDay(userId: number, items: TkLedgerInsert[], watermarks: TkWatermarkUpdate): Promise<TkSyncItemRow[]> {
    return this.db.transaction(async (tx) => {
      const inserted =
        items.length === 0
          ? []
          : await tx
              .insert(schema.tkSyncItems)
              .values(items.map((item): NewTkSyncItem => ({ userId, ...item })))
              .onConflictDoNothing()
              .returning();
      if (Object.keys(watermarks).length > 0) {
        await tx.update(schema.tkUserSettings).set(watermarks).where(eq(schema.tkUserSettings.userId, userId));
      }
      return inserted;
    });
  }
}

function formatAuthors(authorsCsv: string): string {
  return authorsCsv
    ? authorsCsv
        .split('||')
        .filter((a) => a.length > 0)
        .join(', ')
    : '';
}
