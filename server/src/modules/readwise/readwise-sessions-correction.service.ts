import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError, ReadwiseBooksHttpError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import { computePausedSeconds } from './readwise-session-timing.utils';
import type { LinkedSessionForCorrection } from './readwise-sessions-local.repository';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import {
  READWISE_SESSIONS_CORRECTION_BATCH,
  READWISE_SESSIONS_CORRECTION_CURSOR_CACHE_KEY,
  READWISE_SESSIONS_CORRECTION_CURSOR_TTL_MS,
  READWISE_SESSIONS_CORRECTION_ENABLED,
  READWISE_SESSIONS_CORRECTION_MAX_PAGES_PER_RUN,
  READWISE_SESSIONS_CORRECTION_PAGE_SIZE,
} from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';

const EVENT = 'readwise.sessions_correction';

interface PendingCorrection {
  localId: number;
  externalId: string;
  pausedSeconds: number;
}

/**
 * Stage 2 of docs/plans/readwise-session-timing.md §2d: corrects `paused_seconds` on sessions
 * BookOrbit already pushed to Readwise before stage 1 started populating that field, by PATCHing
 * them in place (by Readwise session id). Never re-POSTs: Readwise does not dedupe sessions, so
 * resending one would create a duplicate.
 *
 * IMPORTANT: kept off by default via `READWISE_SESSIONS_CORRECTION_ENABLED`. The live Readwise
 * docs (readwise.io/books_api, "Update sessions") only document `caption` as a field `PATCH
 * /sessions` actually changes, and state outright that times/positions "cannot change [via
 * PATCH]". `paused_seconds` is not confirmed to be applied by that endpoint; it may be silently
 * ignored as an unknown field. This service is fully built, wired and tested so it can be
 * enabled the moment that is confirmed, but must not run for real until then.
 *
 * Progress is a per-user cursor (last local session id considered) in `reading_service_cache`,
 * the same mechanism the books/sessions/highlights pull cursors already use - no schema change.
 * A run is bounded to a few pages so it never stalls the sessions sync flow it rides alongside,
 * and resumable/idempotent: a re-run picks up after the stored cursor, and once every linked
 * session has been considered the query returns nothing, so a re-run patches zero sessions.
 */
@Injectable()
export class ReadwiseSessionsCorrectionService {
  private readonly logger = new Logger(ReadwiseSessionsCorrectionService.name);

  constructor(
    private readonly client: ReadwiseBooksClientService,
    private readonly sessionsRepo: ReadwiseSessionsLocalRepository,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly cache: ReadingServiceCacheService,
  ) {}

  /** Runs a bounded, resumable slice of the correction pass. Never throws. */
  async correctUser(userId: number, token: string): Promise<void> {
    if (!READWISE_SESSIONS_CORRECTION_ENABLED) return;

    const startedAtMs = Date.now();
    let scanned = 0;
    let patched = 0;
    let skipped = 0;
    let failed = 0;
    let cursor = (await this.cache.get<number>(userId, 'readwise', READWISE_SESSIONS_CORRECTION_CURSOR_CACHE_KEY)) ?? 0;

    try {
      for (let page = 0; page < READWISE_SESSIONS_CORRECTION_MAX_PAGES_PER_RUN; page++) {
        const rows = await this.sessionsRepo.findLinkedSessionsForCorrection(userId, cursor, READWISE_SESSIONS_CORRECTION_PAGE_SIZE);
        if (rows.length === 0) break;
        scanned += rows.length;

        const pending: PendingCorrection[] = [];
        for (const row of rows) {
          const pausedSeconds = computePausedSeconds(row);
          if (pausedSeconds > 0) pending.push({ localId: row.id, externalId: row.externalId, pausedSeconds });
          else skipped += 1;
        }

        for (let i = 0; i < pending.length; i += READWISE_SESSIONS_CORRECTION_BATCH) {
          const batch = pending.slice(i, i + READWISE_SESSIONS_CORRECTION_BATCH);
          const outcome = await this.patchBatch(userId, token, batch);
          patched += outcome.patched;
          failed += outcome.failed;
        }

        cursor = rows[rows.length - 1]!.id;
        await this.cache.set(userId, 'readwise', READWISE_SESSIONS_CORRECTION_CURSOR_CACHE_KEY, cursor, READWISE_SESSIONS_CORRECTION_CURSOR_TTL_MS);

        if (rows.length < READWISE_SESSIONS_CORRECTION_PAGE_SIZE) break;
      }

      this.logger.log(
        `[${EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAtMs} scanned=${scanned} patched=${patched} skipped=${skipped} failed=${failed} - sessions correction completed`,
      );
    } catch (err) {
      if (err instanceof ReadwiseBooksForbiddenError) {
        await this.readwiseRepo.upsertSettings(userId, { disabledReason: 'no_readwise_books', enabled: false });
        return;
      }
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      if (err instanceof ReadwiseUnauthorizedError) {
        this.logger.warn(
          `[${EVENT}] [fail] userId=${userId} durationMs=${Date.now() - startedAtMs} errorClass=${errorClass} error="unauthorized" - sessions correction stopped, token invalid`,
        );
        return;
      }
      this.logger.error(
        `[${EVENT}] [fail] userId=${userId} durationMs=${Date.now() - startedAtMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - sessions correction failed`,
      );
    }
  }

  /**
   * PATCHes one batch. On a 4xx, retries item by item (a single bad record should not block the
   * rest of the batch); on any other failure the outcome is unknown, so the batch is left
   * unpatched rather than resent, exactly like the push path's batch handling.
   */
  private async patchBatch(userId: number, token: string, batch: PendingCorrection[]): Promise<{ patched: number; failed: number }> {
    const items = batch.map((entry) => ({ id: entry.externalId, paused_seconds: entry.pausedSeconds }));
    try {
      const results = await this.client.updateSessions(userId, token, items);
      return { patched: results.length, failed: 0 };
    } catch (err) {
      if (err instanceof ReadwiseUnauthorizedError || err instanceof ReadwiseBooksForbiddenError) throw err;
      if (!(err instanceof ReadwiseBooksHttpError && err.status >= 400 && err.status < 500)) {
        const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
        this.logger.error(
          `[${EVENT}] [fail] userId=${userId} sessions=${batch.length} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - correction batch outcome unknown, not retried`,
        );
        return { patched: 0, failed: batch.length };
      }

      let patched = 0;
      let failed = 0;
      for (const entry of batch) {
        try {
          await this.client.updateSessions(userId, token, [{ id: entry.externalId, paused_seconds: entry.pausedSeconds }]);
          patched += 1;
        } catch (itemErr) {
          if (itemErr instanceof ReadwiseUnauthorizedError || itemErr instanceof ReadwiseBooksForbiddenError) throw itemErr;
          failed += 1;
          const errorClass = itemErr instanceof Error ? itemErr.constructor.name : 'UnknownError';
          this.logger.error(
            `[${EVENT}] [fail] userId=${userId} localId=${entry.localId} errorClass=${errorClass} error="${sanitizeLogValue(itemErr instanceof Error ? itemErr.message : String(itemErr))}" - session correction failed, run continues`,
          );
        }
      }
      return { patched, failed };
    }
  }
}

export type { LinkedSessionForCorrection };
