import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, ne, notInArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db';
import * as schema from '../../db/schema';
import { splitReadingSessionByDay } from '../../common/utils/reading-daily-stats.utils';

type Db = NodePgDatabase<typeof schema>;

export interface PushableSession {
  id: number;
  bookFileId: number | null;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  endProgress: number | null;
  progressDelta: number | null;
  sessionType: string;
}

export interface PushableSessionWithBook extends PushableSession {
  bookId: number;
}

export interface PulledReadwiseSession {
  externalId: string;
  bookId: number;
  startedAt: Date;
  endedAt: Date;
  format: 'ebook' | 'audiobook' | 'paper';
}

export interface LinkedSessionForCorrection {
  id: number;
  externalId: string;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  sessionType: string;
}

/**
 * Direct DB access to `reading_sessions` for the S4 Readwise sync, following the existing
 * cross-module read pattern (`readwise-books-local-books.repository.ts`). The pull side also
 * writes here, because inserting the imported session and its ledger row must happen in one
 * transaction (reading-services plan §"S4 tasks", step 1 / step 3).
 */
@Injectable()
export class ReadwiseSessionsLocalRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Local sessions for a book that have never been pushed, oldest first, capped at `limit`. */
  async findPushableSessions(userId: number, bookId: number, minDurationSeconds: number, limit: number): Promise<PushableSession[]> {
    const linked = this.db
      .select({ localId: schema.readingServiceItemLinks.localId })
      .from(schema.readingServiceItemLinks)
      .where(
        and(
          eq(schema.readingServiceItemLinks.userId, userId),
          eq(schema.readingServiceItemLinks.provider, 'readwise'),
          eq(schema.readingServiceItemLinks.kind, 'session'),
        ),
      );

    const rows = await this.db
      .select({
        id: schema.readingSessions.id,
        bookFileId: schema.readingSessions.bookFileId,
        startedAt: schema.readingSessions.startedAt,
        endedAt: schema.readingSessions.endedAt,
        durationSeconds: schema.readingSessions.durationSeconds,
        endProgress: schema.readingSessions.endProgress,
        progressDelta: schema.readingSessions.progressDelta,
        sessionType: schema.readingSessions.sessionType,
      })
      .from(schema.readingSessions)
      .where(
        and(
          eq(schema.readingSessions.userId, userId),
          eq(schema.readingSessions.bookId, bookId),
          ne(schema.readingSessions.source, 'readwise'),
          sql`${schema.readingSessions.durationSeconds} >= ${minDurationSeconds}`,
          notInArray(schema.readingSessions.id, linked),
        ),
      )
      .orderBy(asc(schema.readingSessions.startedAt))
      .limit(limit);

    return rows;
  }

  async resolveBookIdForFile(bookFileId: number): Promise<number | null> {
    const [row] = await this.db
      .select({ bookId: schema.bookFiles.bookId })
      .from(schema.bookFiles)
      .where(eq(schema.bookFiles.id, bookFileId))
      .limit(1);
    return row?.bookId ?? null;
  }

  /**
   * Reconcile-before-create for sessions: a paginated scan of every unlinked, non-readwise local
   * session across all Readwise-linked books, oldest first. Used once per user (see
   * `ReadwiseSessionsReconcileService`) to match sessions that already exist on Readwise - pushed
   * there by a different BookOrbit instance connected to the same account - before the normal
   * per-book push path would otherwise try to create them again.
   */
  async findAllPushableSessions(userId: number, minDurationSeconds: number, afterId: number, limit: number): Promise<PushableSessionWithBook[]> {
    const linked = this.db
      .select({ localId: schema.readingServiceItemLinks.localId })
      .from(schema.readingServiceItemLinks)
      .where(
        and(
          eq(schema.readingServiceItemLinks.userId, userId),
          eq(schema.readingServiceItemLinks.provider, 'readwise'),
          eq(schema.readingServiceItemLinks.kind, 'session'),
        ),
      );

    return this.db
      .select({
        id: schema.readingSessions.id,
        bookId: schema.readingSessions.bookId,
        bookFileId: schema.readingSessions.bookFileId,
        startedAt: schema.readingSessions.startedAt,
        endedAt: schema.readingSessions.endedAt,
        durationSeconds: schema.readingSessions.durationSeconds,
        endProgress: schema.readingSessions.endProgress,
        progressDelta: schema.readingSessions.progressDelta,
        sessionType: schema.readingSessions.sessionType,
      })
      .from(schema.readingSessions)
      .where(
        and(
          eq(schema.readingSessions.userId, userId),
          ne(schema.readingSessions.source, 'readwise'),
          sql`${schema.readingSessions.durationSeconds} >= ${minDurationSeconds}`,
          sql`${schema.readingSessions.id} > ${afterId}`,
          notInArray(schema.readingSessions.id, linked),
        ),
      )
      .orderBy(asc(schema.readingSessions.id))
      .limit(limit);
  }

  /**
   * Stage 2 correction pass (docs/plans/readwise-session-timing.md §2d): pages through every
   * session this user already pushed to Readwise (has a `reading_service_item_links` row),
   * oldest local id first, keyset-paginated by `afterId` so a resumed run never re-scans
   * earlier rows. Excludes pulled-back sessions (`source='readwise'`, already correct) and
   * listening sessions (`sessionType='listen'`, Readwise ignores `paused_seconds` for those).
   */
  async findLinkedSessionsForCorrection(userId: number, afterId: number, limit: number): Promise<LinkedSessionForCorrection[]> {
    return this.db
      .select({
        id: schema.readingSessions.id,
        externalId: schema.readingServiceItemLinks.externalId,
        startedAt: schema.readingSessions.startedAt,
        endedAt: schema.readingSessions.endedAt,
        durationSeconds: schema.readingSessions.durationSeconds,
        sessionType: schema.readingSessions.sessionType,
      })
      .from(schema.readingServiceItemLinks)
      .innerJoin(
        schema.readingSessions,
        and(eq(schema.readingServiceItemLinks.localId, schema.readingSessions.id), eq(schema.readingSessions.userId, userId)),
      )
      .where(
        and(
          eq(schema.readingServiceItemLinks.userId, userId),
          eq(schema.readingServiceItemLinks.provider, 'readwise'),
          eq(schema.readingServiceItemLinks.kind, 'session'),
          isNull(schema.readingServiceItemLinks.deletedAt),
          ne(schema.readingSessions.source, 'readwise'),
          ne(schema.readingSessions.sessionType, 'listen'),
          sql`${schema.readingSessions.id} > ${afterId}`,
        ),
      )
      .orderBy(asc(schema.readingSessions.id))
      .limit(limit);
  }

  /**
   * Matches a just-pulled Readwise session against an unlinked local session on the same book,
   * within a start-time and duration tolerance, so a session that originated in BookOrbit (pushed
   * to Readwise by this instance or another one) links to its own local row on pull instead of
   * being imported as a second, duplicate `source='readwise'` row.
   */
  async findUnlinkedSessionMatch(
    userId: number,
    bookId: number,
    startedAt: Date,
    durationSeconds: number,
    toleranceSeconds: number,
  ): Promise<{ id: number } | undefined> {
    const linked = this.db
      .select({ localId: schema.readingServiceItemLinks.localId })
      .from(schema.readingServiceItemLinks)
      .where(
        and(
          eq(schema.readingServiceItemLinks.userId, userId),
          eq(schema.readingServiceItemLinks.provider, 'readwise'),
          eq(schema.readingServiceItemLinks.kind, 'session'),
        ),
      );

    const [row] = await this.db
      .select({ id: schema.readingSessions.id })
      .from(schema.readingSessions)
      .where(
        and(
          eq(schema.readingSessions.userId, userId),
          eq(schema.readingSessions.bookId, bookId),
          ne(schema.readingSessions.source, 'readwise'),
          notInArray(schema.readingSessions.id, linked),
          sql`abs(extract(epoch from (${schema.readingSessions.startedAt} - ${startedAt.toISOString()}::timestamptz))) <= ${toleranceSeconds}`,
          sql`abs(${schema.readingSessions.durationSeconds} - ${durationSeconds}) <= ${toleranceSeconds}`,
        ),
      )
      .limit(1);
    return row;
  }

  async resolveLibraryIdForBook(bookId: number): Promise<number | null> {
    const [row] = await this.db.select({ libraryId: schema.books.libraryId }).from(schema.books).where(eq(schema.books.id, bookId)).limit(1);
    return row?.libraryId ?? null;
  }

  /**
   * Inserts a pulled Readwise session and its ledger row in one transaction, and increments the
   * daily stats the same way a locally-recorded session does. `endProgress`/`progressDelta` are
   * always null: a Readwise session must contribute to stats only, never move BookOrbit's own
   * reading position (reading-services plan §9).
   */
  async insertPulledSession(userId: number, session: PulledReadwiseSession, timeZone: string): Promise<{ id: number; inserted: boolean }> {
    const libraryId = await this.resolveLibraryIdForBook(session.bookId);
    if (libraryId === null) return { id: -1, inserted: false };

    const durationSeconds = Math.max(0, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000));
    const sessionId = `readwise:${session.externalId}`;

    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(schema.readingSessions)
        .values({
          userId,
          bookId: session.bookId,
          bookFileId: null,
          sessionId,
          source: 'readwise',
          sessionType: session.format === 'audiobook' ? 'listen' : 'read',
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationSeconds,
          progressDelta: null,
          endProgress: null,
        })
        .onConflictDoNothing({ target: [schema.readingSessions.userId, schema.readingSessions.sessionId] })
        .returning({ id: schema.readingSessions.id });

      if (inserted.length === 0) {
        const [existing] = await tx
          .select({ id: schema.readingSessions.id })
          .from(schema.readingSessions)
          .where(and(eq(schema.readingSessions.userId, userId), eq(schema.readingSessions.sessionId, sessionId)))
          .limit(1);
        return { id: existing?.id ?? -1, inserted: false };
      }

      const localId = inserted[0]!.id;

      await tx
        .insert(schema.readingServiceItemLinks)
        .values({
          userId,
          provider: 'readwise',
          kind: 'session',
          localId,
          externalId: session.externalId,
        })
        .onConflictDoNothing();

      const segments = splitReadingSessionByDay(
        { startedAt: session.startedAt, endedAt: session.endedAt, durationSeconds, progressDelta: null },
        timeZone,
      );
      if (segments.length > 0) {
        const now = new Date();
        await tx
          .insert(schema.userReadingDailyStats)
          .values(
            segments.map((segment) => ({
              userId,
              libraryId,
              day: segment.day,
              readingSeconds: segment.readingSeconds,
              progressDelta: segment.progressDelta,
              sessionsCount: segment.sessionsCount,
              updatedAt: now,
            })),
          )
          .onConflictDoUpdate({
            target: [schema.userReadingDailyStats.userId, schema.userReadingDailyStats.libraryId, schema.userReadingDailyStats.day],
            set: {
              readingSeconds: sql`${schema.userReadingDailyStats.readingSeconds} + excluded.reading_seconds`,
              progressDelta: sql`${schema.userReadingDailyStats.progressDelta} + excluded.progress_delta`,
              sessionsCount: sql`${schema.userReadingDailyStats.sessionsCount} + excluded.sessions_count`,
              updatedAt: now,
            },
          });
      }

      return { id: localId, inserted: true };
    });
  }

  /** Removes a previously pulled session and marks its ledger row deleted, idempotently. */
  async removePulledSession(userId: number, localId: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(schema.readingSessions)
        .where(and(eq(schema.readingSessions.userId, userId), eq(schema.readingSessions.id, localId), eq(schema.readingSessions.source, 'readwise')));
      await tx
        .update(schema.readingServiceItemLinks)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(schema.readingServiceItemLinks.userId, userId),
            eq(schema.readingServiceItemLinks.provider, 'readwise'),
            eq(schema.readingServiceItemLinks.kind, 'session'),
            eq(schema.readingServiceItemLinks.localId, localId),
            isNull(schema.readingServiceItemLinks.deletedAt),
          ),
        );
    });
  }

  async resolveUserTimeZone(userId: number): Promise<string> {
    const [row] = await this.db.select({ settings: schema.users.settings }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    const timezone = (row?.settings as { timezone?: unknown } | null)?.timezone;
    return typeof timezone === 'string' && timezone.length > 0 ? timezone : 'UTC';
  }
}
