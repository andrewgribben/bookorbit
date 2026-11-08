import { Injectable, Logger } from '@nestjs/common';

import type { ReadingServiceFeature } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import type { ReadwiseCreateSessionItem } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import type { PushableSession } from './readwise-sessions-local.repository';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import { ReadwiseSessionsReconcileService } from './readwise-sessions-reconcile.service';
import { READWISE_SESSIONS_MIN_PUSH_DURATION_SECONDS, READWISE_SESSIONS_PUSH_PAGE_SIZE, READWISE_SESSIONS_CREATE_BATCH } from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

const EVENT = 'readwise.sessions_push';

function isFeatureEnabled(features: Partial<Record<ReadingServiceFeature, boolean>>, feature: ReadingServiceFeature): boolean {
  // "sessions" is a sync feature, opt-out like the book fields; "publish_sessions" is a social
  // action (posts to the user's Readwise feed) and stays opt-in, default off.
  if (feature === 'publish_sessions') return features[feature] === true;
  return features[feature] !== false;
}

function toCreateItem(session: PushableSession, externalBookId: string, timezone: string, publishToFeed: boolean): ReadwiseCreateSessionItem {
  const format: ReadwiseCreateSessionItem['format'] = session.sessionType === 'listen' ? 'audiobook' : 'ebook';
  const item: ReadwiseCreateSessionItem = {
    book_id: externalBookId,
    started_at: session.startedAt.toISOString(),
    ended_at: session.endedAt.toISOString(),
    format,
    timezone,
    publish_to_feed: publishToFeed,
  };
  if (session.endProgress !== null) {
    const startProgress = session.progressDelta !== null ? Math.max(0, session.endProgress - session.progressDelta) : session.endProgress;
    if (format === 'audiobook') {
      item.position_seconds_at_start = Math.round((startProgress / 100) * session.durationSeconds);
      item.position_seconds_at_end = Math.round((session.endProgress / 100) * session.durationSeconds);
    } else {
      item.percent_at_start = Math.round((startProgress / 100) * 10_000) / 10_000;
      item.percent_at_end = Math.round((session.endProgress / 100) * 10_000) / 10_000;
    }
  }
  return item;
}

/**
 * Pushes unlinked local reading sessions to Readwise Books in batches of 10, per the S4 plan.
 * A session is only eligible once its book has a Readwise link (it is migrated/pushed already)
 * and it has never been linked itself; `publish_to_feed` follows the `publish_sessions` toggle.
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
  ) {}

  async flushUser(userId: number, bookIds: number[]): Promise<void> {
    if (bookIds.length === 0) return;
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return;

    const features = await this.featuresService.getFeatures(userId, 'readwise');
    if (!isFeatureEnabled(features, 'sessions')) return;

    // Reconnect-safe first-connect pass: links any session that already exists on Readwise
    // (pushed there by another BookOrbit instance connected to the same account) before the
    // per-book push below would otherwise try to create it again. A no-op after the first call.
    await this.reconcile.ensureReconciled(userId, token);

    const timezone = await this.sessionsRepo.resolveUserTimeZone(userId);
    const publishToFeed = isFeatureEnabled(features, 'publish_sessions');
    const startedAt = Date.now();
    let pushed = 0;
    let failed = 0;

    for (const bookId of [...new Set(bookIds)]) {
      try {
        pushed += await this.pushBook(userId, token, bookId, timezone, publishToFeed);
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
      `[${EVENT}] [end] userId=${userId} bookCount=${bookIds.length} durationMs=${Date.now() - startedAt} pushed=${pushed} failed=${failed} - sessions push batch completed`,
    );
    if (failed > 0) throw new Error(`${failed} of ${bookIds.length} books failed sessions push to Readwise`);
  }

  /** Returns how many sessions were pushed for this book. */
  private async pushBook(userId: number, token: string, bookId: number, timezone: string, publishToFeed: boolean): Promise<number> {
    const link = await this.readingServicesRepo.findBookLink(userId, 'readwise', bookId);
    if (!link || link.remoteDeleted) return 0; // only push sessions for books already on Readwise

    const sessions = await this.sessionsRepo.findPushableSessions(
      userId,
      bookId,
      READWISE_SESSIONS_MIN_PUSH_DURATION_SECONDS,
      READWISE_SESSIONS_PUSH_PAGE_SIZE,
    );
    if (sessions.length === 0) return 0;

    let pushedCount = 0;
    for (let i = 0; i < sessions.length; i += READWISE_SESSIONS_CREATE_BATCH) {
      const batch = sessions.slice(i, i + READWISE_SESSIONS_CREATE_BATCH);
      pushedCount += await this.pushSessionBatch(userId, token, bookId, link.externalBookId, batch, timezone, publishToFeed);
    }
    return pushedCount;
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
  ): Promise<number> {
    const items = batch.map((session) => toCreateItem(session, externalBookId, timezone, publishToFeed));
    try {
      const results = await this.client.createSessions(userId, token, items);
      return this.recordSessionResults(userId, batch, results);
    } catch (err) {
      if (err instanceof ReadwiseUnauthorizedError || err instanceof ReadwiseBooksForbiddenError) throw err;
      let pushed = 0;
      for (const session of batch) {
        try {
          const singleResult = await this.client.createSessions(userId, token, [toCreateItem(session, externalBookId, timezone, publishToFeed)]);
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
      }));

    await this.readingServicesRepo.recordItemLinks(ledgerItems);
    return ledgerItems.length;
  }
}
