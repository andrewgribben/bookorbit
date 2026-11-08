import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type { ReadingServiceFeature, ReadingServiceProvider, SyncRunProgressCounters } from '@bookorbit/types';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import type { NewReadingServiceBookLink, NewReadingServiceRun, ReadingServiceBookLink, ReadingServiceCacheRow, ReadingServiceRun } from '../../db/schema';

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
}
