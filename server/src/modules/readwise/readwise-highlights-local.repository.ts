import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db';
import * as schema from '../../db/schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * Direct DB writes for the S5 highlights pull, bypassing `AnnotationService`/`AnnotationSyncService`
 * on purpose: those emit `annotation.updated`/`annotation.deleted`, which would otherwise echo
 * straight back into the push side (`ReadwiseSyncService.flush`) on the very next debounce tick.
 * No event, no echo - `ReadwiseSyncService` only ever sees a difference when the *local* side has
 * actually changed since the ledger's last known hash.
 */
@Injectable()
export class ReadwiseHighlightsLocalRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Applies a remote text/note edit to a linked annotation, bumping version so other reading devices still see it. */
  async applyRemoteEdit(userId: number, annotationId: number, patch: { text: string; note: string | null }): Promise<boolean> {
    const result = await this.db
      .update(schema.annotations)
      .set({
        text: patch.text,
        note: patch.note,
        version: sql`${schema.annotations.version} + 1`,
        contentUpdatedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(and(eq(schema.annotations.id, annotationId), eq(schema.annotations.userId, userId), isNull(schema.annotations.deletedAt)))
      .returning({ id: schema.annotations.id });
    return result.length > 0;
  }

  /** Soft-deletes a linked annotation on a remote delete. Idempotent: a no-op if already deleted. */
  async applyRemoteDelete(userId: number, annotationId: number): Promise<boolean> {
    const result = await this.db
      .update(schema.annotations)
      .set({ deletedAt: sql`now()`, version: sql`${schema.annotations.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(schema.annotations.id, annotationId), eq(schema.annotations.userId, userId), isNull(schema.annotations.deletedAt)))
      .returning({ id: schema.annotations.id });
    return result.length > 0;
  }
}
