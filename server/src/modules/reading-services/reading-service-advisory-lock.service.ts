import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { DB } from '../../db';
import * as schema from '../../db/schema';

const EVENT = 'reading_services.advisory_lock';

type Db = NodePgDatabase<typeof schema>;

/**
 * Background provider-sync operations this lock can serialize. One lock key per
 * (operation, userId): the same operation never overlaps for one user, and different
 * operations for the same user never contend with each other.
 */
export type ReadingServiceLockOperation = 'readwise_sessions_push' | 'readwise_sessions_pull' | 'readwise_books_pull' | 'readwise_highlights_pull';

/**
 * Guards a background provider-sync operation against running twice at once for the same user
 * on the same database: two overlapping `@Interval` ticks, a scheduled run racing a manual
 * trigger, or two app replicas pointed at one Postgres instance.
 *
 * Uses `pg_try_advisory_xact_lock`, scoped to the transaction it runs in and released
 * automatically on commit/rollback. This is deliberately not a session-level lock
 * (`pg_advisory_lock`): the DB pool (`server/src/db/db.module.ts`) hands out a connection per
 * query/transaction and returns it to the pool afterwards, so a session-level lock acquired on
 * one borrowed connection could outlive the code that thinks it holds it, or never get released
 * if the connection is recycled before an explicit unlock runs. The xact variant ties the lock's
 * lifetime to the transaction Drizzle already manages, so there is nothing to leak.
 *
 * Skips (never waits) when the lock is already held, since a skipped background tick is simply
 * retried on its own next interval; the caller gets `null` back instead of `fn()`'s result.
 *
 * This only protects same-database concurrency. Two separate BookOrbit installs on separate
 * databases sharing one provider token (e.g. a staging and a live instance) cannot be
 * coordinated by a database lock; see `docs/AGENT_HANDOFF.md` for that gap.
 */
@Injectable()
export class ReadingServiceAdvisoryLockService {
  private readonly logger = new Logger(ReadingServiceAdvisoryLockService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  /** Runs `fn` while holding the lock; returns `null` without calling `fn` if it is already held. */
  async runExclusive<T>(operation: ReadingServiceLockOperation, userId: number, fn: () => Promise<T>): Promise<T | null> {
    const lockKey = `reading_services:${operation}:${userId}`;
    return this.db.transaction(async (tx) => {
      const result = await tx.execute(sql`select pg_try_advisory_xact_lock(hashtext(${lockKey})::bigint) as locked`);
      const locked = (result.rows[0] as { locked?: boolean } | undefined)?.locked === true;
      if (!locked) {
        this.logger.debug(`[${EVENT}] [end] userId=${userId} operation=${operation} locked=false - skipped, lock already held`);
        return null;
      }
      return fn();
    });
  }
}
