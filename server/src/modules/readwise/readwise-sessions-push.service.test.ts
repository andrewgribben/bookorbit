import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseSessionsLocalRepository, type PushableSession } from './readwise-sessions-local.repository';
import { ReadwiseSessionsPushService } from './readwise-sessions-push.service';
import { ReadwiseSessionsReconcileService } from './readwise-sessions-reconcile.service';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

function session(partial: Partial<PushableSession> & { id: number }): PushableSession {
  return {
    bookFileId: 1,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    endedAt: new Date('2026-01-01T00:10:00Z'),
    durationSeconds: 600,
    endProgress: 50,
    progressDelta: 5,
    sessionType: 'read',
    ...partial,
  };
}

function makeService() {
  const client = { createSessions: vi.fn() } as unknown as ReadwiseBooksClientService;
  const sessionsRepo = {
    findPushableSessions: vi.fn().mockResolvedValue([]),
    resolveUserTimeZone: vi.fn().mockResolvedValue('UTC'),
  } as unknown as ReadwiseSessionsLocalRepository;
  const readwiseRepo = { upsertSettings: vi.fn() } as unknown as ReadwiseRepository;
  const readwiseSettings = { getToken: vi.fn().mockResolvedValue('tok') } as unknown as ReadwiseSettingsService;
  const readingServicesRepo = {
    findBookLink: vi.fn(),
    recordItemLinks: vi.fn(),
  } as unknown as ReadingServicesRepository;
  const featuresService = { getFeatures: vi.fn().mockResolvedValue({}) } as unknown as ReadingServiceFeaturesService;
  const reconcile = { ensureReconciled: vi.fn().mockResolvedValue(undefined) } as unknown as ReadwiseSessionsReconcileService;

  const service = new ReadwiseSessionsPushService(
    client,
    sessionsRepo,
    readwiseRepo,
    readwiseSettings,
    readingServicesRepo,
    featuresService,
    reconcile,
  );
  return { service, client, sessionsRepo, readwiseRepo, readwiseSettings, readingServicesRepo, featuresService, reconcile };
}

describe('ReadwiseSessionsPushService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs the reconcile pass before pushing', async () => {
    const { service, reconcile, sessionsRepo } = makeService();
    await service.flushUser(1, [10]);
    expect(reconcile.ensureReconciled).toHaveBeenCalledWith(1, 'tok');
    expect(sessionsRepo.findPushableSessions).not.toHaveBeenCalled();
  });

  it('does nothing when there is no token', async () => {
    const { service, readwiseSettings, readingServicesRepo } = makeService();
    (readwiseSettings.getToken as any).mockResolvedValueOnce(null);
    await service.flushUser(1, [10]);
    expect(readingServicesRepo.findBookLink).not.toHaveBeenCalled();
  });

  it('respects a disabled sessions feature toggle', async () => {
    const { service, featuresService, readingServicesRepo } = makeService();
    (featuresService.getFeatures as any).mockResolvedValueOnce({ sessions: false });
    await service.flushUser(1, [10]);
    expect(readingServicesRepo.findBookLink).not.toHaveBeenCalled();
  });

  it('skips a book with no Readwise link yet', async () => {
    const { service, readingServicesRepo, sessionsRepo } = makeService();
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce(undefined);
    await service.flushUser(1, [10]);
    expect(sessionsRepo.findPushableSessions).not.toHaveBeenCalled();
  });

  it('skips a book the user removed on Readwise (remoteDeleted)', async () => {
    const { service, readingServicesRepo, sessionsRepo } = makeService();
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({ externalBookId: 'r1', remoteDeleted: true });
    await service.flushUser(1, [10]);
    expect(sessionsRepo.findPushableSessions).not.toHaveBeenCalled();
  });

  it('only selects sessions that are unlinked and not source=readwise (via the repo query, asserted by call args)', async () => {
    const { service, readingServicesRepo, sessionsRepo, client } = makeService();
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({ externalBookId: 'r1', remoteDeleted: false });
    (sessionsRepo.findPushableSessions as any).mockResolvedValueOnce([]);

    await service.flushUser(1, [10]);

    expect(sessionsRepo.findPushableSessions).toHaveBeenCalledWith(1, 10, 60, 200);
    expect(client.createSessions).not.toHaveBeenCalled();
  });

  it('pushes sessions in a batch and writes the ledger with the returned external ids', async () => {
    const { service, readingServicesRepo, sessionsRepo, client } = makeService();
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({ externalBookId: 'r1', remoteDeleted: false });
    (sessionsRepo.findPushableSessions as any).mockResolvedValueOnce([session({ id: 100 }), session({ id: 101 })]);
    (client.createSessions as any).mockResolvedValueOnce([{ id: 'ext-100' }, { id: 'ext-101' }]);

    await service.flushUser(1, [10]);

    expect(client.createSessions).toHaveBeenCalledWith(
      1,
      'tok',
      expect.arrayContaining([expect.objectContaining({ book_id: 'r1', publish_to_feed: false })]),
    );
    expect(readingServicesRepo.recordItemLinks).toHaveBeenCalledWith([
      { userId: 1, provider: 'readwise', kind: 'session', localId: 100, externalId: 'ext-100' },
      { userId: 1, provider: 'readwise', kind: 'session', localId: 101, externalId: 'ext-101' },
    ]);
  });

  it('sets publish_to_feed from the publish_sessions toggle (default off)', async () => {
    const { service, readingServicesRepo, sessionsRepo, client, featuresService } = makeService();
    (featuresService.getFeatures as any).mockResolvedValueOnce({ publish_sessions: true });
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({ externalBookId: 'r1', remoteDeleted: false });
    (sessionsRepo.findPushableSessions as any).mockResolvedValueOnce([session({ id: 200 })]);
    (client.createSessions as any).mockResolvedValueOnce([{ id: 'ext-200' }]);

    await service.flushUser(1, [10]);

    expect(client.createSessions).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ publish_to_feed: true })]);
  });

  it('disables the connection on a 403 and stops the batch', async () => {
    const { service, readingServicesRepo, sessionsRepo, client, readwiseRepo } = makeService();
    (readingServicesRepo.findBookLink as any).mockResolvedValue({ externalBookId: 'r1', remoteDeleted: false });
    (sessionsRepo.findPushableSessions as any).mockResolvedValue([session({ id: 300 })]);
    (client.createSessions as any).mockRejectedValueOnce(new ReadwiseBooksForbiddenError());

    await expect(service.flushUser(1, [10, 11])).rejects.toThrow();
    expect(readwiseRepo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'no_readwise_books', enabled: false });
  });

  it('retries a failed batch session by session instead of dropping the whole batch', async () => {
    const { service, readingServicesRepo, sessionsRepo, client } = makeService();
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({ externalBookId: 'r1', remoteDeleted: false });
    (sessionsRepo.findPushableSessions as any).mockResolvedValueOnce([session({ id: 400 }), session({ id: 401 })]);
    (client.createSessions as any)
      .mockRejectedValueOnce(new Error('Readwise Books API error: PATCH /books/api/v1/sessions -> 400'))
      .mockResolvedValueOnce([{ id: 'ext-400' }])
      .mockRejectedValueOnce(new Error('Readwise Books API error: PATCH /books/api/v1/sessions -> 400'));

    await service.flushUser(1, [10]);

    expect(client.createSessions).toHaveBeenCalledTimes(3);
    expect(readingServicesRepo.recordItemLinks).toHaveBeenCalledWith([
      { userId: 1, provider: 'readwise', kind: 'session', localId: 400, externalId: 'ext-400' },
    ]);
  });
});
