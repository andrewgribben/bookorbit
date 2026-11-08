import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import { ReadwiseSessionsPullService } from './readwise-sessions-pull.service';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

function makeService() {
  const client = { listSessions: vi.fn() } as unknown as ReadwiseBooksClientService;
  const readwiseRepo = { findConnectedUserIds: vi.fn().mockResolvedValue([1]), upsertSettings: vi.fn() } as unknown as ReadwiseRepository;
  const readwiseSettings = { getToken: vi.fn().mockResolvedValue('tok') } as unknown as ReadwiseSettingsService;
  const readingServicesRepo = {
    findItemLinkByExternalId: vi.fn(),
    findBookLinkByExternalId: vi.fn(),
  } as unknown as ReadingServicesRepository;
  const featuresService = { getFeatures: vi.fn().mockResolvedValue({}) } as unknown as ReadingServiceFeaturesService;
  const cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn() } as unknown as ReadingServiceCacheService;
  const sessionsRepo = {
    resolveUserTimeZone: vi.fn().mockResolvedValue('UTC'),
    insertPulledSession: vi.fn().mockResolvedValue({ id: 1, inserted: true }),
    removePulledSession: vi.fn(),
  } as unknown as ReadwiseSessionsLocalRepository;

  const service = new ReadwiseSessionsPullService(client, readwiseRepo, readwiseSettings, readingServicesRepo, featuresService, cache, sessionsRepo);
  return { service, client, readwiseRepo, readwiseSettings, readingServicesRepo, featuresService, cache, sessionsRepo };
}

const remoteSession = (partial: Record<string, unknown> = {}) => ({
  id: 'ext-1',
  book_id: 'rb-1',
  started_at: '2026-01-01T00:00:00Z',
  ended_at: '2026-01-01T00:10:00Z',
  format: 'ebook',
  ...partial,
});

describe('ReadwiseSessionsPullService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when there is no token', async () => {
    const { service, readwiseSettings, client } = makeService();
    (readwiseSettings.getToken as any).mockResolvedValueOnce(null);
    await service.pullForUser(1);
    expect(client.listSessions).not.toHaveBeenCalled();
  });

  it('respects a disabled sessions feature toggle', async () => {
    const { service, featuresService, client } = makeService();
    (featuresService.getFeatures as any).mockResolvedValueOnce({ sessions: false });
    await service.pullForUser(1);
    expect(client.listSessions).not.toHaveBeenCalled();
  });

  it('skips a session whose book is not linked yet', async () => {
    const { service, client, readingServicesRepo, sessionsRepo } = makeService();
    (client.listSessions as any).mockResolvedValueOnce({ results: [remoteSession()], next: null });
    (readingServicesRepo.findItemLinkByExternalId as any).mockResolvedValueOnce(undefined);
    (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(undefined);

    await service.pullForUser(1);

    expect(sessionsRepo.insertPulledSession).not.toHaveBeenCalled();
  });

  it('skips a session already in the ledger', async () => {
    const { service, client, readingServicesRepo, sessionsRepo } = makeService();
    (client.listSessions as any).mockResolvedValueOnce({ results: [remoteSession()], next: null });
    (readingServicesRepo.findItemLinkByExternalId as any).mockResolvedValueOnce({ localId: 55, deletedAt: null });

    await service.pullForUser(1);

    expect(sessionsRepo.insertPulledSession).not.toHaveBeenCalled();
    expect(readingServicesRepo.findBookLinkByExternalId).not.toHaveBeenCalled();
  });

  it('inserts a new remote session for an already-linked book, with no local position fields', async () => {
    const { service, client, readingServicesRepo, sessionsRepo } = makeService();
    (client.listSessions as any).mockResolvedValueOnce({ results: [remoteSession()], next: null });
    (readingServicesRepo.findItemLinkByExternalId as any).mockResolvedValueOnce(undefined);
    (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce({ bookId: 42 });

    await service.pullForUser(1);

    expect(sessionsRepo.insertPulledSession).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ externalId: 'ext-1', bookId: 42, format: 'ebook' }),
      'UTC',
    );
  });

  it('soft-removes a locally imported session on a remote delete', async () => {
    const { service, client, readingServicesRepo, sessionsRepo } = makeService();
    (client.listSessions as any).mockResolvedValueOnce({ results: [remoteSession({ is_deleted: true })], next: null });
    (readingServicesRepo.findItemLinkByExternalId as any).mockResolvedValueOnce({ localId: 77, deletedAt: null });

    await service.pullForUser(1);

    expect(sessionsRepo.removePulledSession).toHaveBeenCalledWith(1, 77);
  });

  it('is idempotent on a remote delete already applied', async () => {
    const { service, client, readingServicesRepo, sessionsRepo } = makeService();
    (client.listSessions as any).mockResolvedValueOnce({ results: [remoteSession({ is_deleted: true })], next: null });
    (readingServicesRepo.findItemLinkByExternalId as any).mockResolvedValueOnce({ localId: 77, deletedAt: new Date() });

    await service.pullForUser(1);

    expect(sessionsRepo.removePulledSession).not.toHaveBeenCalled();
  });

  it('disables the connection on a 403', async () => {
    const { service, client, readwiseRepo } = makeService();
    (client.listSessions as any).mockRejectedValueOnce(new ReadwiseBooksForbiddenError());

    await service.pullForUser(1);

    expect(readwiseRepo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'no_readwise_books', enabled: false });
  });
});
