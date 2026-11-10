import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceAdvisoryLockService } from '../reading-services/reading-service-advisory-lock.service';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServiceLibraryScopeService } from '../reading-services/reading-service-library-scope.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { isLibraryFeatureEnabled, type EffectiveLibrarySetting } from '../reading-services/library-scope.utils';
import type { ReadwiseSession } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import {
  READWISE_SESSIONS_PULL_CURSOR_CACHE_KEY,
  READWISE_SESSIONS_PULL_CURSOR_TTL_MS,
  READWISE_SESSIONS_PULL_INTERVAL_MS,
  READWISE_SESSIONS_PULL_USER_CONCURRENCY,
  READWISE_SESSIONS_RECONCILE_TOLERANCE_SECONDS,
} from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

const EVENT = 'readwise.sessions_pull';

/**
 * Interval pull for Readwise sessions, on the same cadence as the S3 books pull. A new remote
 * session (not already in the ledger, and belonging to an already-linked book) is inserted as a
 * local `reading_sessions` row with `source='readwise'`; it contributes to stats only, never to
 * BookOrbit's reading position (`ReadwiseSessionsLocalRepository.insertPulledSession` always
 * writes a null `endProgress`/`progressDelta`, per reading-services plan §9). A remote delete
 * removes the local row and marks the ledger entry deleted, idempotently.
 */
@Injectable()
export class ReadwiseSessionsPullService {
  private readonly logger = new Logger(ReadwiseSessionsPullService.name);

  constructor(
    private readonly client: ReadwiseBooksClientService,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly readwiseSettings: ReadwiseSettingsService,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly featuresService: ReadingServiceFeaturesService,
    private readonly cache: ReadingServiceCacheService,
    private readonly sessionsRepo: ReadwiseSessionsLocalRepository,
    private readonly lock: ReadingServiceAdvisoryLockService,
    private readonly libraryScopeService: ReadingServiceLibraryScopeService,
  ) {}

  @Interval(READWISE_SESSIONS_PULL_INTERVAL_MS)
  async pullAllConnectedUsers(): Promise<void> {
    const userIds = await this.readwiseRepo.findConnectedUserIds();
    for (let i = 0; i < userIds.length; i += READWISE_SESSIONS_PULL_USER_CONCURRENCY) {
      const batch = userIds.slice(i, i + READWISE_SESSIONS_PULL_USER_CONCURRENCY);
      await Promise.all(batch.map((userId) => this.pullForUser(userId).catch((err) => this.logFailure(userId, err))));
    }
  }

  /**
   * Serialized per user via an advisory lock: a session pull writes new local rows and marks
   * ledger links, so an overlapping run (two @Interval ticks racing, or two instances/replicas
   * sharing one database) risks a duplicate insert or a lost update. A run that loses the race
   * is skipped and retried on the next interval.
   */
  async pullForUser(userId: number): Promise<void> {
    const ran = await this.lock.runExclusive('readwise_sessions_pull', userId, () => this.pullForUserLocked(userId));
    if (ran === null) this.logger.debug(`[${EVENT}] [end] userId=${userId} - skipped, another pull already running`);
  }

  private async pullForUserLocked(userId: number): Promise<void> {
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return;

    const features = await this.featuresService.getFeatures(userId, 'readwise');
    if (features.sessions === false) return;

    const librarySettings = await this.libraryScopeService.getEffectiveLibrarySettingsForUserId(userId, 'readwise');

    const updatedAfter = await this.cache.get<string>(userId, 'readwise', READWISE_SESSIONS_PULL_CURSOR_CACHE_KEY);
    const startedAt = Date.now();
    const nowIso = new Date().toISOString();
    const timezone = await this.sessionsRepo.resolveUserTimeZone(userId);

    try {
      let applied = 0;
      let cursor: string | undefined;
      for (;;) {
        const page = await this.client.listSessions(userId, token, {
          order: 'updated',
          updatedAfter: updatedAfter ?? undefined,
          includeDeleted: true,
          cursor,
        });
        for (const session of page.results) {
          if (await this.applyRemoteSession(userId, session, timezone, librarySettings)) applied += 1;
        }
        if (!page.next) break;
        cursor = page.next;
      }

      await this.cache.set(userId, 'readwise', READWISE_SESSIONS_PULL_CURSOR_CACHE_KEY, nowIso, READWISE_SESSIONS_PULL_CURSOR_TTL_MS);
      this.logger.log(`[${EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAt} applied=${applied} - sessions pull completed`);
    } catch (err) {
      if (err instanceof ReadwiseBooksForbiddenError) {
        await this.readwiseRepo.upsertSettings(userId, { disabledReason: 'no_readwise_books', enabled: false });
        return;
      }
      throw err;
    }
  }

  private async applyRemoteSession(
    userId: number,
    session: ReadwiseSession,
    timezone: string,
    librarySettings: ReadonlyMap<number, EffectiveLibrarySetting>,
  ): Promise<boolean> {
    if (session.is_deleted) {
      const link = await this.readingServicesRepo.findItemLinkByExternalId(userId, 'readwise', 'session', session.id);
      if (!link || link.deletedAt) return false;
      await this.sessionsRepo.removePulledSession(userId, link.localId);
      return true;
    }

    const existing = await this.readingServicesRepo.findItemLinkByExternalId(userId, 'readwise', 'session', session.id);
    if (existing) return false; // already pulled, or it is a session this user's own push just created

    const bookLink = await this.readingServicesRepo.findBookLinkByExternalId(userId, 'readwise', session.book_id);
    if (!bookLink) return false; // the book isn't migrated/linked yet; S4 only syncs sessions on linked books

    // A comic series' shared Readwise book has many local issues pointing at one externalBookId
    // (matchMethod 'series'); findBookLinkByExternalId above only ever returns one of them
    // arbitrarily, so a remote session on the series book cannot be attributed to a single
    // issue. Series sessions are push-only in v1, same as the books pull.
    if (bookLink.matchMethod === 'series') return false;

    const libraryId = await this.sessionsRepo.resolveLibraryIdForBook(bookLink.bookId);
    if (!isLibraryFeatureEnabled(librarySettings, libraryId, 'sessions', true)) return false;

    // Reconnect-safe: a session that originated in BookOrbit - pushed to Readwise by this
    // instance or by a different one connected to the same account - must link to its own local
    // row here, never be imported as a second `source='readwise'` duplicate.
    const startedAt = new Date(session.started_at);
    const durationSeconds = Math.max(0, Math.round((new Date(session.ended_at).getTime() - startedAt.getTime()) / 1000));
    const localMatch = await this.sessionsRepo.findUnlinkedSessionMatch(
      userId,
      bookLink.bookId,
      startedAt,
      durationSeconds,
      READWISE_SESSIONS_RECONCILE_TOLERANCE_SECONDS,
    );
    if (localMatch) {
      await this.readingServicesRepo.recordItemLinks([
        { userId, provider: 'readwise', kind: 'session', localId: localMatch.id, externalId: session.id },
      ]);
      return false; // linked, not imported as a new row - no new stats to add
    }

    const result = await this.sessionsRepo.insertPulledSession(
      userId,
      {
        externalId: session.id,
        bookId: bookLink.bookId,
        startedAt,
        endedAt: new Date(session.ended_at),
        format: session.format,
      },
      timezone,
    );
    return result.inserted;
  }

  private logFailure(userId: number, err: unknown): void {
    const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
    this.logger.error(
      `[${EVENT}] [fail] userId=${userId} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - sessions pull failed`,
    );
  }
}
