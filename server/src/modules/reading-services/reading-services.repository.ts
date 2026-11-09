import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { ReadingServiceFeature, ReadingServiceProvider, SyncRunProgressCounters } from '@bookorbit/types';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import type {
  NewReadingServiceBookLink,
  NewReadingServiceItemLink,
  NewReadingServiceRun,
  ReadingServiceBookLink,
  ReadingServiceCacheRow,
  ReadingServiceItemLink,
  ReadingServiceLibrarySettingRow,
  ReadingServiceRun,
} from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class ReadingServicesRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  // ---- Features ----

  async findFeatures(userId: number, provider: ReadingServiceProvider): Promise<Partial<Record<ReadingServiceFeature, boolean>>> {
    const rows = await this.db.query.readingServiceFeatures.findMany({
      where: and(eq(schema.readingServiceFeatures.userId, userId), eq(schema.readingServiceFeatures.provider, provider)),
    });
    const result: Partial<Record<ReadingServiceFeature, boolean>> = {};
    for (const row of rows) {
      result[row.feature as ReadingServiceFeature] = row.enabled;
    }
    return result;
  }

  async setFeature(userId: number, provider: ReadingServiceProvider, feature: ReadingServiceFeature, enabled: boolean): Promise<void> {
    await this.db
      .insert(schema.readingServiceFeatures)
      .values({ userId, provider, feature, enabled })
      .onConflictDoUpdate({
        target: [schema.readingServiceFeatures.userId, schema.readingServiceFeatures.provider, schema.readingServiceFeatures.feature],
        set: { enabled, updatedAt: new Date() },
      });
  }

  // ---- Library settings ----

  async isSuperuser(userId: number): Promise<boolean> {
    const [user] = await this.db.select({ isSuperuser: schema.users.isSuperuser }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    return user?.isSuperuser ?? false;
  }

  /** Only rows that override the "inherit" default; the service layer fills in defaults for the rest. */
  async findLibrarySettings(userId: number, provider: ReadingServiceProvider): Promise<ReadingServiceLibrarySettingRow[]> {
    return this.db.query.readingServiceLibrarySettings.findMany({
      where: and(eq(schema.readingServiceLibrarySettings.userId, userId), eq(schema.readingServiceLibrarySettings.provider, provider)),
    });
  }

  async setLibrarySetting(
    userId: number,
    provider: ReadingServiceProvider,
    libraryId: number,
    settings: { enabled: boolean; features: Partial<Record<string, boolean>> },
  ): Promise<void> {
    await this.db
      .insert(schema.readingServiceLibrarySettings)
      .values({ userId, provider, libraryId, enabled: settings.enabled, features: settings.features })
      .onConflictDoUpdate({
        target: [
          schema.readingServiceLibrarySettings.userId,
          schema.readingServiceLibrarySettings.provider,
          schema.readingServiceLibrarySettings.libraryId,
        ],
        set: { enabled: settings.enabled, features: settings.features, updatedAt: new Date() },
      });
  }

  /** Reverts a library back to "inherit" by deleting its override row. */
  async deleteLibrarySetting(userId: number, provider: ReadingServiceProvider, libraryId: number): Promise<void> {
    await this.db
      .delete(schema.readingServiceLibrarySettings)
      .where(
        and(
          eq(schema.readingServiceLibrarySettings.userId, userId),
          eq(schema.readingServiceLibrarySettings.provider, provider),
          eq(schema.readingServiceLibrarySettings.libraryId, libraryId),
        ),
      );
  }

  // ---- Cache ----

  async findCache(userId: number, provider: ReadingServiceProvider, key: string): Promise<ReadingServiceCacheRow | undefined> {
    return this.db.query.readingServiceCache.findFirst({
      where: and(
        eq(schema.readingServiceCache.userId, userId),
        eq(schema.readingServiceCache.provider, provider),
        eq(schema.readingServiceCache.key, key),
      ),
    });
  }

  async setCache(userId: number, provider: ReadingServiceProvider, key: string, payload: unknown, expiresAt: Date): Promise<void> {
    await this.db
      .insert(schema.readingServiceCache)
      .values({ userId, provider, key, payload, expiresAt })
      .onConflictDoUpdate({
        target: [schema.readingServiceCache.userId, schema.readingServiceCache.provider, schema.readingServiceCache.key],
        set: { payload, expiresAt },
      });
  }

  // ---- Sync runs ----

  async createRun(
    userId: number,
    provider: ReadingServiceProvider,
    kind: ReadingServiceRun['kind'],
    counters: SyncRunProgressCounters,
  ): Promise<ReadingServiceRun> {
    const [row] = await this.db
      .insert(schema.readingServiceRuns)
      .values({ userId, provider, kind, status: 'running', counters, cursor: {} } as NewReadingServiceRun)
      .returning();
    return row!;
  }

  async findRun(id: number, userId: number): Promise<ReadingServiceRun | undefined> {
    return this.db.query.readingServiceRuns.findFirst({
      where: and(eq(schema.readingServiceRuns.id, id), eq(schema.readingServiceRuns.userId, userId)),
    });
  }

  async findRunningRun(userId: number, provider: ReadingServiceProvider, kind: ReadingServiceRun['kind']): Promise<ReadingServiceRun | undefined> {
    return this.db.query.readingServiceRuns.findFirst({
      where: and(
        eq(schema.readingServiceRuns.userId, userId),
        eq(schema.readingServiceRuns.provider, provider),
        eq(schema.readingServiceRuns.kind, kind),
        eq(schema.readingServiceRuns.status, 'running'),
      ),
      orderBy: desc(schema.readingServiceRuns.id),
    });
  }

  // Scoped to active rows only: this backs the boot-time resume sweep, which by definition is
  // the one place that legitimately needs every user's unfinished runs, not one user's.
  async findRunningRuns(): Promise<ReadingServiceRun[]> {
    return this.db.query.readingServiceRuns.findMany({
      where: eq(schema.readingServiceRuns.status, 'running'),
    });
  }

  async updateRun(id: number, patch: Partial<Pick<ReadingServiceRun, 'cursor' | 'counters' | 'status' | 'error' | 'finishedAt'>>): Promise<void> {
    await this.db.update(schema.readingServiceRuns).set(patch).where(eq(schema.readingServiceRuns.id, id));
  }

  async findLatestRun(userId: number, provider: ReadingServiceProvider, kind: ReadingServiceRun['kind']): Promise<ReadingServiceRun | undefined> {
    return this.db.query.readingServiceRuns.findFirst({
      where: and(
        eq(schema.readingServiceRuns.userId, userId),
        eq(schema.readingServiceRuns.provider, provider),
        eq(schema.readingServiceRuns.kind, kind),
      ),
      orderBy: desc(schema.readingServiceRuns.id),
    });
  }

  // ---- Book links ----

  async findBookLink(userId: number, provider: ReadingServiceProvider, bookId: number): Promise<ReadingServiceBookLink | undefined> {
    return this.db.query.readingServiceBookLinks.findFirst({
      where: and(
        eq(schema.readingServiceBookLinks.userId, userId),
        eq(schema.readingServiceBookLinks.provider, provider),
        eq(schema.readingServiceBookLinks.bookId, bookId),
      ),
    });
  }

  async findBookLinkByExternalId(
    userId: number,
    provider: ReadingServiceProvider,
    externalBookId: string,
  ): Promise<ReadingServiceBookLink | undefined> {
    return this.db.query.readingServiceBookLinks.findFirst({
      where: and(
        eq(schema.readingServiceBookLinks.userId, userId),
        eq(schema.readingServiceBookLinks.provider, provider),
        eq(schema.readingServiceBookLinks.externalBookId, externalBookId),
      ),
    });
  }

  async findBookLinksForProvider(userId: number, provider: ReadingServiceProvider): Promise<ReadingServiceBookLink[]> {
    return this.db.query.readingServiceBookLinks.findMany({
      where: and(eq(schema.readingServiceBookLinks.userId, userId), eq(schema.readingServiceBookLinks.provider, provider)),
    });
  }

  /** One batched lookup for a page of bookIds, so the migration push phase does not issue a query per book. */
  async findBookLinksForBookIds(userId: number, provider: ReadingServiceProvider, bookIds: number[]): Promise<ReadingServiceBookLink[]> {
    if (bookIds.length === 0) return [];
    return this.db.query.readingServiceBookLinks.findMany({
      where: and(
        eq(schema.readingServiceBookLinks.userId, userId),
        eq(schema.readingServiceBookLinks.provider, provider),
        inArray(schema.readingServiceBookLinks.bookId, bookIds),
      ),
    });
  }

  async markRemoteDeleted(userId: number, provider: ReadingServiceProvider, bookId: number): Promise<void> {
    await this.db
      .update(schema.readingServiceBookLinks)
      .set({ remoteDeleted: true })
      .where(
        and(
          eq(schema.readingServiceBookLinks.userId, userId),
          eq(schema.readingServiceBookLinks.provider, provider),
          eq(schema.readingServiceBookLinks.bookId, bookId),
        ),
      );
  }

  async upsertBookLink(
    userId: number,
    provider: ReadingServiceProvider,
    bookId: number,
    data: Pick<NewReadingServiceBookLink, 'externalBookId' | 'matchMethod' | 'snapshot'> & { lastSyncedAt?: Date },
  ): Promise<void> {
    const values: NewReadingServiceBookLink = {
      userId,
      provider,
      bookId,
      externalBookId: data.externalBookId,
      matchMethod: data.matchMethod,
      snapshot: data.snapshot,
      lastSyncedAt: data.lastSyncedAt ?? new Date(),
    };
    await this.db
      .insert(schema.readingServiceBookLinks)
      .values(values)
      .onConflictDoUpdate({
        target: [schema.readingServiceBookLinks.userId, schema.readingServiceBookLinks.provider, schema.readingServiceBookLinks.bookId],
        set: {
          externalBookId: values.externalBookId,
          matchMethod: values.matchMethod,
          snapshot: values.snapshot,
          lastSyncedAt: values.lastSyncedAt,
          syncError: null,
        },
      });
  }

  // ---- Item ledger (sessions, highlights) ----

  async findItemLinksByLocalIds(
    userId: number,
    provider: ReadingServiceProvider,
    kind: string,
    localIds: number[],
  ): Promise<ReadingServiceItemLink[]> {
    if (localIds.length === 0) return [];
    return this.db.query.readingServiceItemLinks.findMany({
      where: and(
        eq(schema.readingServiceItemLinks.userId, userId),
        eq(schema.readingServiceItemLinks.provider, provider),
        eq(schema.readingServiceItemLinks.kind, kind),
        inArray(schema.readingServiceItemLinks.localId, localIds),
      ),
    });
  }

  async findItemLinkByExternalId(
    userId: number,
    provider: ReadingServiceProvider,
    kind: string,
    externalId: string,
  ): Promise<ReadingServiceItemLink | undefined> {
    return this.db.query.readingServiceItemLinks.findFirst({
      where: and(
        eq(schema.readingServiceItemLinks.userId, userId),
        eq(schema.readingServiceItemLinks.provider, provider),
        eq(schema.readingServiceItemLinks.kind, kind),
        eq(schema.readingServiceItemLinks.externalId, externalId),
      ),
    });
  }

  // Inserted as one multi-row statement, which Postgres runs as a single atomic write: this is
  // the "same transaction" the S4 ledger write requires for a batch of just-posted session ids.
  // It does not cover the gap between the Readwise POST and this call (see push service comment).
  async recordItemLinks(items: NewReadingServiceItemLink[]): Promise<void> {
    if (items.length === 0) return;
    await this.db.insert(schema.readingServiceItemLinks).values(items).onConflictDoNothing();
  }

  async markItemLinkDeleted(userId: number, provider: ReadingServiceProvider, kind: string, localId: number): Promise<void> {
    await this.db
      .update(schema.readingServiceItemLinks)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(schema.readingServiceItemLinks.userId, userId),
          eq(schema.readingServiceItemLinks.provider, provider),
          eq(schema.readingServiceItemLinks.kind, kind),
          eq(schema.readingServiceItemLinks.localId, localId),
        ),
      );
  }

  /** Updates an existing ledger row's content fingerprint and re-sync timestamp (a push or pull edit), unlike `recordItemLinks` which only inserts. */
  async updateItemLinkContentHash(
    userId: number,
    provider: ReadingServiceProvider,
    kind: string,
    localId: number,
    contentHash: string,
  ): Promise<void> {
    await this.db
      .update(schema.readingServiceItemLinks)
      .set({ contentHash, syncedAt: new Date() })
      .where(
        and(
          eq(schema.readingServiceItemLinks.userId, userId),
          eq(schema.readingServiceItemLinks.provider, provider),
          eq(schema.readingServiceItemLinks.kind, kind),
          eq(schema.readingServiceItemLinks.localId, localId),
        ),
      );
  }
}
