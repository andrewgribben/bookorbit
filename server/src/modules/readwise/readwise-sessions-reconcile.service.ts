import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import type { ReadwiseSession } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import {
  READWISE_SESSIONS_MIN_PUSH_DURATION_SECONDS,
  READWISE_SESSIONS_PUSH_PAGE_SIZE,
  READWISE_SESSIONS_RECONCILE_TOLERANCE_SECONDS,
  READWISE_SESSIONS_RECONCILED_CACHE_KEY,
  READWISE_SESSIONS_RECONCILED_TTL_MS,
} from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';

const EVENT = 'readwise.sessions_reconcile';

/**
 * First-connect reconcile for sessions: runs once per user (gated by a cache flag, mirroring
 * `ReadwiseHighlightsLedgerBackfillService`), fetching every remote session once and linking any
 * unlinked local session that already matches one instead of letting the normal push path create
 * a duplicate. This is what makes a fresh BookOrbit database - connecting to a Readwise account
 * another BookOrbit instance (e.g. a staging copy) already synced from - reconnect-safe for
 * sessions: without this pass every locally-recorded, Readwise-eligible session would look
 * unlinked and get pushed again as a brand-new session.
 *
 * Matching: same linked book (`externalBookId`), start time within
 * `READWISE_SESSIONS_RECONCILE_TOLERANCE_SECONDS`, and duration within the same tolerance. Both
 * sides are BookOrbit-authored session shapes (one book, one contiguous read), so this is enough
 * to identify "the same session" without a stronger external key - Readwise sessions carry no
 * BookOrbit id of their own.
 */
@Injectable()
export class ReadwiseSessionsReconcileService {
  private readonly logger = new Logger(ReadwiseSessionsReconcileService.name);

  constructor(
    private readonly client: ReadwiseBooksClientService,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly cache: ReadingServiceCacheService,
    private readonly sessionsRepo: ReadwiseSessionsLocalRepository,
  ) {}

  /** Runs the reconcile pass once per user; a no-op on every later call. */
  async ensureReconciled(userId: number, token: string): Promise<void> {
    const done = await this.cache.get<boolean>(userId, 'readwise', READWISE_SESSIONS_RECONCILED_CACHE_KEY);
    if (done) return;
    await this.reconcile(userId, token);
    await this.cache.set(userId, 'readwise', READWISE_SESSIONS_RECONCILED_CACHE_KEY, true, READWISE_SESSIONS_RECONCILED_TTL_MS);
  }

  private async reconcile(userId: number, token: string): Promise<void> {
    const startedAtMs = Date.now();
    const bookLinks = await this.readingServicesRepo.findBookLinksForProvider(userId, 'readwise');
    if (bookLinks.length === 0) return;
    const externalBookIdByLocalBookId = new Map(bookLinks.map((link) => [link.bookId, link.externalBookId]));

    try {
      const remoteSessions = await this.fetchAllRemoteSessions(userId, token);
      const remoteByExternalBookId = new Map<string, ReadwiseSession[]>();
      for (const session of remoteSessions) {
        if (session.is_deleted) continue;
        const bucket = remoteByExternalBookId.get(session.book_id);
        if (bucket) bucket.push(session);
        else remoteByExternalBookId.set(session.book_id, [session]);
      }

      const consumedExternalIds = new Set<string>();
      let linked = 0;
      let afterId = 0;
      for (;;) {
        const page = await this.sessionsRepo.findAllPushableSessions(
          userId,
          READWISE_SESSIONS_MIN_PUSH_DURATION_SECONDS,
          afterId,
          READWISE_SESSIONS_PUSH_PAGE_SIZE,
        );
        if (page.length === 0) break;

        const items: Parameters<ReadingServicesRepository['recordItemLinks']>[0] = [];
        for (const session of page) {
          const externalBookId = externalBookIdByLocalBookId.get(session.bookId);
          if (!externalBookId) continue;
          const candidates = remoteByExternalBookId.get(externalBookId) ?? [];
          const match = candidates.find(
            (candidate) =>
              !consumedExternalIds.has(candidate.id) &&
              this.matches(session.startedAt, session.durationSeconds, candidate.started_at, candidate.ended_at),
          );
          if (!match) continue;
          consumedExternalIds.add(match.id);
          items.push({ userId, provider: 'readwise' as const, kind: 'session', localId: session.id, externalId: match.id });
        }
        await this.readingServicesRepo.recordItemLinks(items);
        linked += items.length;

        afterId = page[page.length - 1]!.id;
        if (page.length < READWISE_SESSIONS_PUSH_PAGE_SIZE) break;
      }

      this.logger.log(
        `[${EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAtMs} remoteSessions=${remoteSessions.length} linked=${linked} - sessions reconcile completed`,
      );
    } catch (err) {
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      this.logger.warn(
        `[${EVENT}] [fail] userId=${userId} durationMs=${Date.now() - startedAtMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - sessions reconcile failed`,
      );
      if (err instanceof ReadwiseBooksForbiddenError) return;
      throw err;
    }
  }

  private matches(localStartedAt: Date, localDurationSeconds: number, remoteStartedAt: string, remoteEndedAt: string): boolean {
    const remoteStart = new Date(remoteStartedAt).getTime();
    const remoteDurationSeconds = Math.max(0, Math.round((new Date(remoteEndedAt).getTime() - remoteStart) / 1000));
    const startDeltaSeconds = Math.abs(localStartedAt.getTime() - remoteStart) / 1000;
    const durationDeltaSeconds = Math.abs(localDurationSeconds - remoteDurationSeconds);
    return startDeltaSeconds <= READWISE_SESSIONS_RECONCILE_TOLERANCE_SECONDS && durationDeltaSeconds <= READWISE_SESSIONS_RECONCILE_TOLERANCE_SECONDS;
  }

  private async fetchAllRemoteSessions(userId: number, token: string): Promise<ReadwiseSession[]> {
    const all: ReadwiseSession[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await this.client.listSessions(userId, token, { includeDeleted: false, cursor });
      all.push(...page.results);
      if (!page.next) break;
      cursor = page.next;
    }
    return all;
  }
}
