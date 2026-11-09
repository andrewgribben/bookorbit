import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import { readwiseSessionContentHash } from './readwise-session-hash.utils';
import type { DeleteUnlinkTarget } from './readwise-sessions-delete-unlink.service';
import { ReadwiseSessionsDeleteUnlinkService } from './readwise-sessions-delete-unlink.service';
import type { LinkedSessionForRepair } from './readwise-sessions-local.repository';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import {
  READWISE_SESSIONS_REPAIR_BATCH,
  READWISE_SESSIONS_REPAIR_MAX_PAGES_PER_CALL,
  READWISE_SESSIONS_REPAIR_PAGE_SIZE,
} from './readwise.constants';

const EVENT = 'readwise.sessions_repair';

/**
 * Fixes an already-linked session whose local row changed since it was pushed - the live bug
 * where a koreader session is pushed while still "open" (next upload extends the same cluster),
 * so Readwise ends up holding a truncated copy. Readwise's session times/positions cannot be
 * PATCHed (readwise.io/books_api: "delete the session and record it again"), so a changed
 * session is deleted and unlinked here; the push path right after this call re-POSTs it (now
 * unlinked) with the current, correct numbers and a fresh content hash.
 *
 * Runs on every per-book flush (triggered by a READING_SESSION_SAVED event for that book), not
 * as a one-time pass, since growth can happen at any time a koreader upload extends a session
 * that was already pushed. Bounded and keyset-paged per book so one flush never does unbounded
 * work even for a book with a very long session history.
 *
 * A link with `contentHash: null` predates this change. Per the agreed rule: only treat it as
 * changed when `endedAt > syncedAt` (the session's local row kept moving after the push that
 * created the link - exactly the live truncated-session case); otherwise backfill the hash
 * without touching Readwise, so later flushes can compare normally.
 */
@Injectable()
export class ReadwiseSessionsRepairService {
  private readonly logger = new Logger(ReadwiseSessionsRepairService.name);

  constructor(
    private readonly sessionsRepo: ReadwiseSessionsLocalRepository,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly deleteUnlink: ReadwiseSessionsDeleteUnlinkService,
  ) {}

  /** Returns how many sessions were unlinked for re-push (the caller's push path picks them up). */
  async repairBook(userId: number, token: string, bookId: number): Promise<number> {
    const startedAtMs = Date.now();
    let scanned = 0;
    let changed = 0;
    let backfilled = 0;
    let failed = 0;
    let afterId = 0;

    try {
      for (let page = 0; page < READWISE_SESSIONS_REPAIR_MAX_PAGES_PER_CALL; page++) {
        const rows = await this.sessionsRepo.findLinkedSessionsForBook(userId, bookId, afterId, READWISE_SESSIONS_REPAIR_PAGE_SIZE);
        if (rows.length === 0) break;
        scanned += rows.length;

        const pending: DeleteUnlinkTarget[] = [];
        for (const row of rows) {
          const outcome = this.classify(row);
          if (outcome === 'changed') pending.push({ localId: row.id, bookId: row.bookId, externalId: row.externalId });
          else if (outcome === 'backfill') {
            await this.readingServicesRepo.updateItemLinkContentHash(userId, 'readwise', 'session', row.id, readwiseSessionContentHash(row));
            backfilled += 1;
          }
        }

        for (let i = 0; i < pending.length; i += READWISE_SESSIONS_REPAIR_BATCH) {
          const batch = pending.slice(i, i + READWISE_SESSIONS_REPAIR_BATCH);
          const result = await this.deleteUnlink.deleteAndUnlink(userId, token, EVENT, batch);
          changed += result.deleted;
          failed += result.failed;
        }

        afterId = rows[rows.length - 1]!.id;
        if (rows.length < READWISE_SESSIONS_REPAIR_PAGE_SIZE) break;
      }

      this.logger.log(
        `[${EVENT}] [end] userId=${userId} bookId=${bookId} durationMs=${Date.now() - startedAtMs} scanned=${scanned} changed=${changed} backfilled=${backfilled} failed=${failed} - session repair completed`,
      );
      return changed;
    } catch (err) {
      if (err instanceof ReadwiseBooksForbiddenError || err instanceof ReadwiseUnauthorizedError) throw err;
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      this.logger.error(
        `[${EVENT}] [fail] userId=${userId} bookId=${bookId} durationMs=${Date.now() - startedAtMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - session repair failed`,
      );
      return changed;
    }
  }

  private classify(row: LinkedSessionForRepair): 'changed' | 'backfill' | 'unchanged' {
    const currentHash = readwiseSessionContentHash(row);
    if (row.contentHash !== null) {
      return currentHash !== row.contentHash ? 'changed' : 'unchanged';
    }
    return row.endedAt.getTime() > row.syncedAt.getTime() ? 'changed' : 'backfill';
  }
}
