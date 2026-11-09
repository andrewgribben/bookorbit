import { Injectable, Logger } from '@nestjs/common';

import type { ReadingServiceFeature } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import type { ReadwiseCreateSessionItem } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError, ReadwiseBooksHttpError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import { readwiseSessionContentHash } from './readwise-session-hash.utils';
import { computePausedSeconds, isSessionSettled, settleAtFor } from './readwise-session-timing.utils';
import { ReadwiseSessionsBackfillSweepService } from './readwise-sessions-backfill-sweep.service';
import type { PushableSession } from './readwise-sessions-local.repository';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import { ReadwiseSessionsCorrectionService } from './readwise-sessions-correction.service';
import { ReadwiseSessionsReconcileService } from './readwise-sessions-reconcile.service';
import { ReadwiseSessionsRepairService } from './readwise-sessions-repair.service';
import {
  READWISE_SESSIONS_FEED_MAX_AGE_MS,
  READWISE_SESSIONS_MIN_PUSH_DURATION_SECONDS,
  READWISE_SESSIONS_PUSH_PAGE_SIZE,
  READWISE_SESSIONS_CREATE_BATCH,
} from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

const EVENT = 'readwise.sessions_push';

function isFeatureEnabled(features: Partial<Record<ReadingServiceFeature, boolean>>, feature: ReadingServiceFeature): boolean {
  // "sessions" is a sync feature, opt-out like the book fields; "publish_sessions" is a social
  // action (posts to the user's Readwise feed) and stays opt-in, default off.
  if (feature === 'publish_sessions') return features[feature] === true;
  return features[feature] !== false;
}

function toCreateItem(
  session: PushableSession,
  externalBookId: string,
  timezone: string,
  publishToFeed: boolean,
  audiobookTotalSeconds: number | null,
): ReadwiseCreateSessionItem {
  const format: ReadwiseCreateSessionItem['format'] = session.sessionType === 'listen' ? 'audiobook' : 'ebook';
  const item: ReadwiseCreateSessionItem = {
    book_id: externalBookId,
    started_at: session.startedAt.toISOString(),
    ended_at: session.endedAt.toISOString(),
    format,
    timezone,
    // Old sessions (a backfill, a sweep, or a correction re-post) count on Readwise but must not
    // flood the feed with posts for reading done days or weeks ago.
    publish_to_feed: publishToFeed && Date.now() - session.endedAt.getTime() <= READWISE_SESSIONS_FEED_MAX_AGE_MS,
  };
  // Readwise counts ended_at - started_at - paused_seconds as reading time; durationSeconds is active time only.
  // Audiobook duration comes from the positions instead, so paused_seconds would not apply there.
  const pausedSeconds = computePausedSeconds(session);
  if (format === 'ebook' && pausedSeconds > 0) item.paused_seconds = pausedSeconds;
  if (session.endProgress !== null) {
    const startProgress = session.progressDelta !== null ? Math.max(0, session.endProgress - session.progressDelta) : session.endProgress;
    if (format === 'audiobook') {
      // percent is of the whole audiobook, not of this session: scale by the book's total
      // duration, not session.durationSeconds (readwise-sessions-push.service.test.ts covers the
      // regression). When the total is unknown, fall back to [0, durationSeconds] so Readwise at
      // least credits the session's own measured listening time, rather than a wrong position.
      if (audiobookTotalSeconds !== null && audiobookTotalSeconds > 0) {
        item.seconds_at_start = Math.round((startProgress / 100) * audiobookTotalSeconds);
        item.seconds_at_end = Math.round((session.endProgress / 100) * audiobookTotalSeconds);
      } else {
        item.seconds_at_start = 0;
        item.seconds_at_end = session.durationSeconds;
      }
    } else {
      item.percent_at_start = Math.round((startProgress / 100) * 10_000) / 10_000;
      item.percent_at_end = Math.round((session.endProgress / 100) * 10_000) / 10_000;
    }
  }
  return item;
}

export interface FlushResult {
  /** Books with a session that was skipped because it had not settled yet, with the earliest time it will. */
  settleRetries: { bookId: number; nextSettleAt: Date }[];
}

/**
 * Pushes unlinked local reading sessions to Readwise Books in batches of 10, per the S4 plan.
 * A session is only eligible once its book has a Readwise link (it is migrated/pushed already)
 * and it has never been linked itself; `publish_to_feed` follows the `publish_sessions` toggle.
 *
 * A session is only pushed once it has settled (docs/plans/readwise-session-timing.md): a later
 * koreader page-stat upload, or a later web/Android/iOS write superseding a checkpoint, would
 * extend the same local row, so pushing it any earlier risks Readwise ending up with a
 * truncated copy (see `settleAtFor`). An unsettled session is left unlinked and its book is returned in
 * `settleRetries` so the scheduler can retry once it has settled.
 *
 * shortcut: the ledger write happens right after each batch's POST succeeds, in one multi-row
 * insert, but that is not the same database transaction as the POST itself (there isn't one -
 * Readwise is a separate service). A crash between the POST response and `recordItemLinks`
 * leaves those sessions unlinked, so the next flush re-sends them and Readwise records a
 * duplicate (readwise-api.md §3: session POSTs are not idempotent). Accepted per the plan.
 */
@Injectable()
export class ReadwiseSessionsPushService {
  private readonly logger = new Logger(ReadwiseSessionsPushService.name);

  constructor(
    private readonly client: ReadwiseBooksClientService,
    private readonly sessionsRepo: ReadwiseSessionsLocalRepository,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly readwiseSettings: ReadwiseSettingsService,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly featuresService: ReadingServiceFeaturesService,
    private readonly reconcile: ReadwiseSessionsReconcileService,
    private readonly correction: ReadwiseSessionsCorrectionService,
    private readonly repair: ReadwiseSessionsRepairService,
    private readonly sweep: ReadwiseSessionsBackfillSweepService,
  ) {}

  async flushUser(userId: number, bookIds: number[]): Promise<FlushResult> {
    if (bookIds.length === 0) return { settleRetries: [] };
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return { settleRetries: [] };

    const features = await this.featuresService.getFeatures(userId, 'readwise');
    if (!isFeatureEnabled(features, 'sessions')) return { settleRetries: [] };

    // Reconnect-safe first-connect pass: links any session that already exists on Readwise
    // (pushed there by another BookOrbit instance connected to the same account) before the
    // per-book push below would otherwise try to create it again. A no-op after the first call.
    await this.reconcile.ensureReconciled(userId, token);

    // One-time correction pass (docs/plans/readwise-session-timing.md §2d): deletes and unlinks
    // sessions pushed before paused_seconds existed, so the push below re-POSTs them with the
    // right numbers in the same flush where possible. Bounded per call, resumable via its own
    // cursor, and a no-op after the one-time pass finishes (see READWISE_SESSIONS_CORRECTION_*).
    const correctedBookIds = await this.correction.correctUser(userId, token);

    // One-time sweep for books whose settled sessions were never requested for push (large
    // KOReader backfills used to raise no push request at all; see
    // ReadwiseSessionsBackfillSweepService). A no-op after the one-time pass finishes.
    const sweptBookIds = await this.sweep.ensureSwept(userId);

    const timezone = await this.sessionsRepo.resolveUserTimeZone(userId);
    const publishToFeed = isFeatureEnabled(features, 'publish_sessions');
    const startedAt = Date.now();
    let pushed = 0;
    let failed = 0;
    const settleRetries: { bookId: number; nextSettleAt: Date }[] = [];

    for (const bookId of [...new Set([...bookIds, ...correctedBookIds, ...sweptBookIds])]) {
      try {
        const result = await this.pushBook(userId, token, bookId, timezone, publishToFeed);
        pushed += result.pushedCount;
        if (result.nextSettleAt) settleRetries.push({ bookId, nextSettleAt: result.nextSettleAt });
      } catch (err) {
        failed += 1;
        if (err instanceof ReadwiseBooksForbiddenError) {
          await this.readwiseRepo.upsertSettings(userId, { disabledReason: 'no_readwise_books', enabled: false });
          break;
        }
        const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
        this.logger.error(
          `[${EVENT}] [fail] userId=${userId} bookId=${bookId} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - sessions push failed`,
        );
      }
    }

    this.logger.log(
      `[${EVENT}] [end] userId=${userId} bookCount=${bookIds.length} durationMs=${Date.now() - startedAt} pushed=${pushed} failed=${failed} settleRetries=${settleRetries.length} - sessions push batch completed`,
    );
    if (failed > 0) throw new Error(`${failed} of ${bookIds.length} books failed sessions push to Readwise`);
    return { settleRetries };
  }

  /** Pushes new sessions for this book and repairs any linked session that changed since it was pushed. */
  private async pushBook(
    userId: number,
    token: string,
    bookId: number,
    timezone: string,
    publishToFeed: boolean,
  ): Promise<{ pushedCount: number; nextSettleAt: Date | null }> {
    const link = await this.readingServicesRepo.findBookLink(userId, 'readwise', bookId);
    if (!link || link.remoteDeleted) return { pushedCount: 0, nextSettleAt: null }; // only push sessions for books already on Readwise

    // Unlinks any session whose startedAt/endedAt/durationSeconds changed since it was pushed
    // (a koreader session that grew), so the push below re-POSTs it with the current numbers.
    await this.repair.repairBook(userId, token, bookId);

    const sessions = await this.sessionsRepo.findPushableSessions(
      userId,
      bookId,
      READWISE_SESSIONS_MIN_PUSH_DURATION_SECONDS,
      READWISE_SESSIONS_PUSH_PAGE_SIZE,
    );
    if (sessions.length === 0) return { pushedCount: 0, nextSettleAt: null };

    const settled: PushableSession[] = [];
    let nextSettleAt: Date | null = null;
    for (const session of sessions) {
      if (isSessionSettled(session)) {
        settled.push(session);
        continue;
      }
      const settleAt = settleAtFor(session);
      if (!nextSettleAt || settleAt < nextSettleAt) nextSettleAt = settleAt;
    }
    if (settled.length === 0) return { pushedCount: 0, nextSettleAt };

    // One batched lookup per push page, not one per session: a listen session's position needs
    // the audiobook's total duration, but every session in this page shares the same book.
    const audiobookTotalSeconds = settled.some((session) => session.sessionType === 'listen')
      ? await this.sessionsRepo.findAudiobookTotalSeconds(bookId)
      : null;

    let pushedCount = 0;
    for (let i = 0; i < settled.length; i += READWISE_SESSIONS_CREATE_BATCH) {
      const batch = settled.slice(i, i + READWISE_SESSIONS_CREATE_BATCH);
      pushedCount += await this.pushSessionBatch(userId, token, bookId, link.externalBookId, batch, timezone, publishToFeed, audiobookTotalSeconds);
    }
    return { pushedCount, nextSettleAt };
  }

  /**
   * POSTs one batch of up to `READWISE_SESSIONS_CREATE_BATCH` sessions. If the whole batch call
   * fails (e.g. a 400 from one malformed session), it is retried one session at a time so a
   * single bad record doesn't drop every session in the batch; a session still failing after
   * the retry is logged with its local id and the Readwise error and simply left unlinked (the
   * next flush will pick it up again), rather than aborting the rest of the book's sessions.
   */
  private async pushSessionBatch(
    userId: number,
    token: string,
    bookId: number,
    externalBookId: string,
    batch: PushableSession[],
    timezone: string,
    publishToFeed: boolean,
    audiobookTotalSeconds: number | null,
  ): Promise<number> {
    const items = batch.map((session) => toCreateItem(session, externalBookId, timezone, publishToFeed, audiobookTotalSeconds));
    let results: Awaited<ReturnType<ReadwiseBooksClientService['createSessions']>>;
    try {
      results = await this.client.createSessions(userId, token, items);
    } catch (err) {
      if (err instanceof ReadwiseUnauthorizedError || err instanceof ReadwiseBooksForbiddenError) throw err;
      // Readwise does not dedupe sessions: only resend when it rejected the request outright (4xx).
      if (!(err instanceof ReadwiseBooksHttpError && err.status >= 400 && err.status < 500)) {
        const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
        this.logger.error(
          `[${EVENT}] [fail] userId=${userId} bookId=${bookId} sessions=${batch.length} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - session batch outcome unknown, not resent`,
        );
        return 0;
      }
      let pushed = 0;
      for (const session of batch) {
        try {
          const singleResult = await this.client.createSessions(userId, token, [
            toCreateItem(session, externalBookId, timezone, publishToFeed, audiobookTotalSeconds),
          ]);
          pushed += await this.recordSessionResults(userId, [session], singleResult);
        } catch (itemErr) {
          if (itemErr instanceof ReadwiseUnauthorizedError || itemErr instanceof ReadwiseBooksForbiddenError) throw itemErr;
          const errorClass = itemErr instanceof Error ? itemErr.constructor.name : 'UnknownError';
          this.logger.error(
            `[${EVENT}] [fail] userId=${userId} bookId=${bookId} sessionId=${session.id} errorClass=${errorClass} error="${sanitizeLogValue(itemErr instanceof Error ? itemErr.message : String(itemErr))}" - session push failed, run continues`,
          );
        }
      }
      return pushed;
    }
    return this.recordSessionResults(userId, batch, results);
  }

  private async recordSessionResults(userId: number, batch: PushableSession[], results: { id: string }[]): Promise<number> {
    const ledgerItems = batch
      .map((session, index) => ({ session, externalId: results[index]?.id }))
      .filter((entry): entry is { session: PushableSession; externalId: string } => Boolean(entry.externalId))
      .map(({ session, externalId }) => ({
        userId,
        provider: 'readwise' as const,
        kind: 'session',
        localId: session.id,
        externalId,
        contentHash: readwiseSessionContentHash(session),
      }));

    await this.readingServicesRepo.recordItemLinks(ledgerItems);
    return ledgerItems.length;
  }
}
