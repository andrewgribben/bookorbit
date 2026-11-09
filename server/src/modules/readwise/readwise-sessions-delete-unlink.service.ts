import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import type { ReadwiseDeleteSessionResult } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';

export interface DeleteUnlinkTarget {
  localId: number;
  bookId: number;
  externalId: string;
}

export interface DeleteUnlinkOutcome {
  deleted: number;
  unlinkedBookIds: number[];
  failed: number;
}

/**
 * Shared DELETE-then-unlink batch logic for Readwise sessions. Per readwise.io/books_api,
 * `PATCH /sessions` cannot change times or positions ("delete the session and record it
 * again"), and `POST /sessions` is never deduped, so every place that needs to correct an
 * already-pushed session (the one-time paused_seconds correction, and the ongoing
 * grown-session repair) must DELETE on Readwise first, then unlink locally only once the
 * delete is confirmed - never on an unknown outcome (network error, 5xx, unexpected shape),
 * since that would let the next flush re-POST a session Readwise still has, creating a
 * duplicate.
 */
@Injectable()
export class ReadwiseSessionsDeleteUnlinkService {
  private readonly logger = new Logger(ReadwiseSessionsDeleteUnlinkService.name);

  constructor(
    private readonly client: ReadwiseBooksClientService,
    private readonly sessionsRepo: ReadwiseSessionsLocalRepository,
  ) {}

  /** `event` names the caller's own log event, so logs stay grouped by the operation that triggered them. */
  async deleteAndUnlink(userId: number, token: string, event: string, batch: DeleteUnlinkTarget[]): Promise<DeleteUnlinkOutcome> {
    if (batch.length === 0) return { deleted: 0, unlinkedBookIds: [], failed: 0 };

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
        `[${event}] [fail] userId=${userId} sessions=${batch.length} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - delete batch outcome unknown, links kept`,
      );
      return { deleted: 0, unlinkedBookIds: [], failed: batch.length };
    }

    let deleted = 0;
    let failed = 0;
    const toUnlink: DeleteUnlinkTarget[] = [];
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
          `[${event}] [fail] userId=${userId} localId=${entry.localId} errorClass=ReadwiseDeleteSessionError error="${sanitizeLogValue(result?.error?.code ?? result?.status ?? 'unknown')}" - session delete failed, link kept`,
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
