import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import type { ReadwiseDeleteSessionResult } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import { computePausedSeconds } from './readwise-session-timing.utils';
import type { LinkedSessionForCorrection } from './readwise-sessions-local.repository';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import {
  READWISE_SESSIONS_CORRECTION_BATCH,
  READWISE_SESSIONS_CORRECTION_CURSOR_CACHE_KEY,
  READWISE_SESSIONS_CORRECTION_CURSOR_TTL_MS,
  READWISE_SESSIONS_CORRECTION_DONE_CACHE_KEY,
  READWISE_SESSIONS_CORRECTION_DONE_TTL_MS,
  READWISE_SESSIONS_CORRECTION_MAX_PAGES_PER_RUN,
  READWISE_SESSIONS_CORRECTION_MIN_GAP_SECONDS,
  READWISE_SESSIONS_CORRECTION_PAGE_SIZE,
} from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';

const EVENT = 'readwise.sessions_correction';

interface PendingCorrection {
  localId: number;
  bookId: number;
  externalId: string;
}

/**
 * One-time fix (docs/plans/readwise-session-timing.md §2d) for sessions BookOrbit pushed to
 * Readwise before it started sending `paused_seconds`, so their recorded reading time is
 * inflated by however long the device sat idle mid-session. Per the live Readwise docs
 * (readwise.io/books_api): `PATCH /sessions` cannot change times or positions ("delete the
 * session and record it again"), and `POST /sessions` is never deduped. The only correct fix is
 * therefore: DELETE the inflated session on Readwise first, then unlink it locally so the
 * existing push path (which already sends `paused_seconds` for every new session) re-POSTs it
 * with the right numbers on the same or next flush. Deleting first means a crash between the
 * delete and the unlink can only leave the link stale for the next run to retry - DELETE on an
 * id already gone answers `not_found`, which is treated as success - never a duplicate.
 *
 * Runs once per user: progress is a keyset cursor (last local session id considered) plus a
 * "done" flag, both in `reading_service_cache` (the same mechanism as
 * `ReadwiseSessionsReconcileService`). A run is bounded to a few pages so it never stalls the
 * sessions sync flow it rides alongside; once a pass finds no more eligible rows, the done flag
 * is set and every later call for this user is a no-op.
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

  /**
   * Runs a bounded, resumable slice of the one-time correction pass. Never throws. Returns the
   * ids of books whose sessions were unlinked, so the caller can push them again even when the
   * user has not read those books recently.
   */
  async correctUser(userId: number, token: string): Promise<number[]> {
    const done = await this.cache.get<boolean>(userId, 'readwise', READWISE_SESSIONS_CORRECTION_DONE_CACHE_KEY);
    if (done) return [];
    const unlinkedBookIds = new Set<number>();

    const startedAtMs = Date.now();
    let scanned = 0;
    let deleted = 0;
    let unlinked = 0;
    let skipped = 0;
    let failed = 0;
    let cursor = (await this.cache.get<number>(userId, 'readwise', READWISE_SESSIONS_CORRECTION_CURSOR_CACHE_KEY)) ?? 0;
    let finishedPass = false;

    try {
      for (let page = 0; page < READWISE_SESSIONS_CORRECTION_MAX_PAGES_PER_RUN; page++) {
        const rows = await this.sessionsRepo.findLinkedSessionsForCorrection(userId, cursor, READWISE_SESSIONS_CORRECTION_PAGE_SIZE);
        if (rows.length === 0) {
          finishedPass = true;
          break;
        }
        scanned += rows.length;

        const pending: PendingCorrection[] = [];
        for (const row of rows) {
          const gapSeconds = computePausedSeconds(row);
          if (gapSeconds >= READWISE_SESSIONS_CORRECTION_MIN_GAP_SECONDS)
            pending.push({ localId: row.id, bookId: row.bookId, externalId: row.externalId });
          else skipped += 1;
        }

        for (let i = 0; i < pending.length; i += READWISE_SESSIONS_CORRECTION_BATCH) {
          const batch = pending.slice(i, i + READWISE_SESSIONS_CORRECTION_BATCH);
          const outcome = await this.deleteAndUnlinkBatch(userId, token, batch);
          deleted += outcome.deleted;
          unlinked += outcome.unlinkedBookIds.length;
          failed += outcome.failed;
          for (const bookId of outcome.unlinkedBookIds) unlinkedBookIds.add(bookId);
        }

        cursor = rows[rows.length - 1]!.id;
        await this.cache.set(userId, 'readwise', READWISE_SESSIONS_CORRECTION_CURSOR_CACHE_KEY, cursor, READWISE_SESSIONS_CORRECTION_CURSOR_TTL_MS);

        if (rows.length < READWISE_SESSIONS_CORRECTION_PAGE_SIZE) {
          finishedPass = true;
          break;
        }
      }

      if (finishedPass) {
        await this.cache.set(userId, 'readwise', READWISE_SESSIONS_CORRECTION_DONE_CACHE_KEY, true, READWISE_SESSIONS_CORRECTION_DONE_TTL_MS);
      }

      this.logger.log(
        `[${EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAtMs} scanned=${scanned} deleted=${deleted} unlinked=${unlinked} skipped=${skipped} failed=${failed} - sessions correction completed`,
      );
      return [...unlinkedBookIds];
    } catch (err) {
      if (err instanceof ReadwiseBooksForbiddenError) {
        await this.readwiseRepo.upsertSettings(userId, { disabledReason: 'no_readwise_books', enabled: false });
        return [];
      }
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      if (err instanceof ReadwiseUnauthorizedError) {
        this.logger.warn(
          `[${EVENT}] [fail] userId=${userId} durationMs=${Date.now() - startedAtMs} errorClass=${errorClass} error="unauthorized" - sessions correction stopped, token invalid`,
        );
        return [...unlinkedBookIds];
      }
      this.logger.error(
        `[${EVENT}] [fail] userId=${userId} durationMs=${Date.now() - startedAtMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - sessions correction failed`,
      );
      return [...unlinkedBookIds];
    }
  }

  /**
   * DELETEs one batch on Readwise, then unlinks every local session whose delete outcome is
   * known to be gone (`status: 'deleted'`, or `error.code: 'not_found'` - already gone, same
   * end state). An id that errors for any other reason (e.g. `invalid_value`, a session that
   * never ended) keeps its link and is retried on the next run; if the whole request's outcome
   * is unknown (network error, 5xx, or an unexpected response shape) every link in the batch is
   * left alone too, exactly like the push path's batch handling - never unlink on a guess.
   */
  private async deleteAndUnlinkBatch(
    userId: number,
    token: string,
    batch: PendingCorrection[],
  ): Promise<{ deleted: number; unlinkedBookIds: number[]; failed: number }> {
    let results: ReadwiseDeleteSessionResult[];
    try {
      results = await this.client.deleteSessions(
        userId,
        token,
        batch.map((entry) => entry.externalId),
      );
    } catch (err) {
      if (err instanceof ReadwiseUnauthorizedError || err instanceof ReadwiseBooksForbiddenError) throw err;
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      this.logger.error(
        `[${EVENT}] [fail] userId=${userId} sessions=${batch.length} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - delete batch outcome unknown, links kept`,
      );
      return { deleted: 0, unlinkedBookIds: [], failed: batch.length };
    }

    let deleted = 0;
    let failed = 0;
    const toUnlink: PendingCorrection[] = [];
    for (let i = 0; i < batch.length; i++) {
      const entry = batch[i]!;
      const result = results[i];
      const gone = result?.status === 'deleted' || result?.error?.code === 'not_found';
      if (gone) {
        deleted += 1;
        toUnlink.push(entry);
      } else {
        failed += 1;
        this.logger.error(
          `[${EVENT}] [fail] userId=${userId} localId=${entry.localId} errorClass=ReadwiseDeleteSessionError error="${sanitizeLogValue(result?.error?.code ?? result?.status ?? 'unknown')}" - session delete failed, link kept`,
        );
      }
    }

    if (toUnlink.length > 0) {
      await this.sessionsRepo.unlinkSessions(
        userId,
        toUnlink.map((entry) => entry.localId),
      );
    }
    return { deleted, unlinkedBookIds: toUnlink.map((entry) => entry.bookId), failed };
  }
}

export type { LinkedSessionForCorrection };
