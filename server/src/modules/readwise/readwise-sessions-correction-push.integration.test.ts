import { describe, expect, it, vi } from 'vitest';

import { ReadingServiceAdvisoryLockService } from '../reading-services/reading-service-advisory-lock.service';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseBooksClientService } from './readwise-books-client.service';
import { ReadwiseSessionsBackfillSweepService } from './readwise-sessions-backfill-sweep.service';
import { ReadwiseSessionsCorrectionService } from './readwise-sessions-correction.service';
import { ReadwiseSessionsDeleteUnlinkService } from './readwise-sessions-delete-unlink.service';
import { ReadwiseSessionsLocalRepository, type LinkedSessionForCorrection } from './readwise-sessions-local.repository';
import { ReadwiseSessionsPushService } from './readwise-sessions-push.service';
import { ReadwiseSessionsReconcileService } from './readwise-sessions-reconcile.service';
import { ReadwiseSessionsRepairService } from './readwise-sessions-repair.service';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

/**
 * Integration test for the full one-time correction flow against the real push path: a session
 * that was pushed before `paused_seconds` existed gets DELETEd, unlinked, then picked back up
 * by the (also real) push path in the same flush and re-POSTed with `paused_seconds` included.
 * Everything downstream of the two real services under test is mocked - no real Readwise call,
 * no real DB - but the wiring between them (correction -> unlink -> push re-selects) is real.
 */
describe('Readwise session correction -> push integration', () => {
  it('re-posts a corrected session through the real push path with paused_seconds included', async () => {
    const linkedRow: LinkedSessionForCorrection = {
      id: 100,
      bookId: 20,
      externalId: 'ext-100',
      startedAt: new Date('2026-01-01T00:00:00Z'),
      endedAt: new Date('2026-01-01T01:00:00Z'),
      durationSeconds: 1200,
      sessionType: 'read',
    };

    const client = {
      deleteSessions: vi.fn().mockResolvedValue([{ id: 'ext-100', status: 'deleted', error: null }]),
      createSessions: vi.fn().mockResolvedValue([{ id: 'ext-100-new' }]),
    } as unknown as ReadwiseBooksClientService;

    const sessionsRepo = {
      findLinkedSessionsForCorrection: vi.fn().mockResolvedValueOnce([linkedRow]).mockResolvedValue([]),
      findLinkedSessionsForBook: vi.fn().mockResolvedValue([]),
      findAllPushableSessions: vi.fn().mockResolvedValue([]),
      unlinkSessions: vi.fn().mockResolvedValue(undefined),
      findPushableSessions: vi.fn().mockResolvedValue([
        {
          id: 100,
          bookFileId: 1,
          startedAt: linkedRow.startedAt,
          endedAt: linkedRow.endedAt,
          durationSeconds: linkedRow.durationSeconds,
          endProgress: null,
          progressDelta: null,
          sessionType: 'read',
          source: 'web',
        },
      ]),
      resolveUserTimeZone: vi.fn().mockResolvedValue('UTC'),
    } as unknown as ReadwiseSessionsLocalRepository;

    const readwiseRepo = { upsertSettings: vi.fn() } as unknown as ReadwiseRepository;
    const cacheStore = new Map<string, unknown>();
    const cache = {
      get: vi.fn((userId: number, provider: string, key: string) => Promise.resolve(cacheStore.get(`${userId}:${provider}:${key}`) ?? null)),
      set: vi.fn((userId: number, provider: string, key: string, value: unknown) => {
        cacheStore.set(`${userId}:${provider}:${key}`, value);
        return Promise.resolve();
      }),
    } as unknown as import('../reading-services/reading-service-cache.service').ReadingServiceCacheService;

    const deleteUnlinkService = new ReadwiseSessionsDeleteUnlinkService(client, sessionsRepo);
    const correction = new ReadwiseSessionsCorrectionService(sessionsRepo, readwiseRepo, cache, deleteUnlinkService);

    const readingServicesRepo = {
      findBookLink: vi.fn().mockResolvedValue({ externalBookId: 'rwbook-1', remoteDeleted: false }),
      recordItemLinks: vi.fn(),
      updateItemLinkContentHash: vi.fn(),
    } as unknown as ReadingServicesRepository;
    const readwiseSettings = { getToken: vi.fn().mockResolvedValue('tok') } as unknown as ReadwiseSettingsService;
    const featuresService = { getFeatures: vi.fn().mockResolvedValue({}) } as unknown as ReadingServiceFeaturesService;
    const reconcile = { ensureReconciled: vi.fn().mockResolvedValue(undefined) } as unknown as ReadwiseSessionsReconcileService;
    const repair = new ReadwiseSessionsRepairService(sessionsRepo, readingServicesRepo, deleteUnlinkService);
    const sweep = new ReadwiseSessionsBackfillSweepService(sessionsRepo, cache);
    const lock = {
      runExclusive: (_op: string, _userId: number, fn: () => Promise<unknown>) => fn(),
    } as unknown as ReadingServiceAdvisoryLockService;

    const pushService = new ReadwiseSessionsPushService(
      client,
      sessionsRepo,
      readwiseRepo,
      readwiseSettings,
      readingServicesRepo,
      featuresService,
      reconcile,
      correction,
      repair,
      sweep,
      lock,
    );

    await pushService.flushUser(1, [10]);

    expect(sessionsRepo.findPushableSessions).toHaveBeenCalledWith(1, 20, expect.any(Number), expect.any(Number));
    expect(client.deleteSessions).toHaveBeenCalledWith(1, 'tok', ['ext-100']);
    expect(sessionsRepo.unlinkSessions).toHaveBeenCalledWith(1, [100]);
    expect(client.createSessions).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ paused_seconds: 2400 })]);
    expect(readingServicesRepo.recordItemLinks).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 1, provider: 'readwise', kind: 'session', localId: 100, externalId: 'ext-100-new' }),
    ]);
  });
});
