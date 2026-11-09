import { Injectable, Logger } from '@nestjs/common';

import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { isSessionSettled } from './readwise-session-timing.utils';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import {
  READWISE_SESSIONS_MIN_PUSH_DURATION_SECONDS,
  READWISE_SESSIONS_SWEEP_CURSOR_CACHE_KEY,
  READWISE_SESSIONS_SWEEP_CURSOR_TTL_MS,
  READWISE_SESSIONS_SWEEP_DONE_CACHE_KEY,
  READWISE_SESSIONS_SWEEP_DONE_TTL_MS,
  READWISE_SESSIONS_SWEEP_MAX_PAGES_PER_RUN,
  READWISE_SESSIONS_SWEEP_PAGE_SIZE,
} from './readwise.constants';

const EVENT = 'readwise.sessions_sweep';

/**
 * One-time per-user backfill: the KOReader backfill path (a large page-stat upload, more than
 * `KOREADER_BACKFILL_EVENT_THRESHOLD` changed sessions) used to request no Readwise push at
 * all, so any book whose backfilled sessions landed before this fix stayed with unlinked,
 * never-pushed sessions even though the book itself is Readwise-linked. This sweep finds every
 * such book once per user and returns its id so the caller (`ReadwiseSessionsPushService`) can
 * push it in the same flush, the same way the one-time correction pass returns book ids to
 * push. Runs on every flush until done; a no-op after that (same cache-flag shape as
 * `ReadwiseSessionsReconcileService`/`ReadwiseSessionsCorrectionService`).
 */
@Injectable()
export class ReadwiseSessionsBackfillSweepService {
  private readonly logger = new Logger(ReadwiseSessionsBackfillSweepService.name);

  constructor(
    private readonly sessionsRepo: ReadwiseSessionsLocalRepository,
    private readonly cache: ReadingServiceCacheService,
  ) {}

  async ensureSwept(userId: number): Promise<number[]> {
    const done = await this.cache.get<boolean>(userId, 'readwise', READWISE_SESSIONS_SWEEP_DONE_CACHE_KEY);
    if (done) return [];

    const startedAtMs = Date.now();
    const bookIds = new Set<number>();
    let scanned = 0;
    let cursor = (await this.cache.get<number>(userId, 'readwise', READWISE_SESSIONS_SWEEP_CURSOR_CACHE_KEY)) ?? 0;
    let finishedPass = false;

    for (let page = 0; page < READWISE_SESSIONS_SWEEP_MAX_PAGES_PER_RUN; page++) {
      const rows = await this.sessionsRepo.findAllPushableSessions(
        userId,
        READWISE_SESSIONS_MIN_PUSH_DURATION_SECONDS,
        cursor,
        READWISE_SESSIONS_SWEEP_PAGE_SIZE,
      );
      if (rows.length === 0) {
        finishedPass = true;
        break;
      }
      scanned += rows.length;

      for (const row of rows) {
        if (isSessionSettled(row)) bookIds.add(row.bookId);
      }

      cursor = rows[rows.length - 1]!.id;
      await this.cache.set(userId, 'readwise', READWISE_SESSIONS_SWEEP_CURSOR_CACHE_KEY, cursor, READWISE_SESSIONS_SWEEP_CURSOR_TTL_MS);

      if (rows.length < READWISE_SESSIONS_SWEEP_PAGE_SIZE) {
        finishedPass = true;
        break;
      }
    }

    if (finishedPass) {
      await this.cache.set(userId, 'readwise', READWISE_SESSIONS_SWEEP_DONE_CACHE_KEY, true, READWISE_SESSIONS_SWEEP_DONE_TTL_MS);
    }

    this.logger.log(
      `[${EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAtMs} scanned=${scanned} books=${bookIds.size} - sessions sweep completed`,
    );
    return [...bookIds];
  }
}
