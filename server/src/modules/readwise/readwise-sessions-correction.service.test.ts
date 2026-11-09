import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import type { LinkedSessionForCorrection } from './readwise-sessions-local.repository';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import { ReadwiseSessionsCorrectionService } from './readwise-sessions-correction.service';
import { ReadwiseRepository } from './readwise.repository';

function linkedSession(partial: Partial<LinkedSessionForCorrection> & { id: number; externalId: string }): LinkedSessionForCorrection {
  return {
    startedAt: new Date('2026-01-01T00:00:00Z'),
    endedAt: new Date('2026-01-01T00:10:00Z'),
    durationSeconds: 600,
    sessionType: 'read',
    ...partial,
  };
}

function makeService() {
  const client = { deleteSessions: vi.fn() } as unknown as ReadwiseBooksClientService;
  const sessionsRepo = {
    findLinkedSessionsForCorrection: vi.fn().mockResolvedValue([]),
    unlinkSessions: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReadwiseSessionsLocalRepository;
  const readwiseRepo = { upsertSettings: vi.fn() } as unknown as ReadwiseRepository;
  const cacheStore = new Map<string, unknown>();
  const cache = {
    get: vi.fn((userId: number, provider: string, key: string) => Promise.resolve(cacheStore.get(`${userId}:${provider}:${key}`) ?? null)),
    set: vi.fn((userId: number, provider: string, key: string, value: unknown) => {
      cacheStore.set(`${userId}:${provider}:${key}`, value);
      return Promise.resolve();
    }),
  } as unknown as ReadingServiceCacheService;

  const service = new ReadwiseSessionsCorrectionService(client, sessionsRepo, readwiseRepo, cache);
  return { service, client, sessionsRepo, readwiseRepo, cache, cacheStore };
}

describe('ReadwiseSessionsCorrectionService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the inflated session on Readwise before unlinking it locally', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({
        id: 100,
        externalId: 'ext-100',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        endedAt: new Date('2026-01-01T01:00:00Z'),
        durationSeconds: 1200,
      }),
    ]);
    const callOrder: string[] = [];
    (client.deleteSessions as any).mockImplementation(() => {
      callOrder.push('delete');
      return Promise.resolve([{ id: 'ext-100', status: 'deleted', error: null }]);
    });
    (sessionsRepo.unlinkSessions as any).mockImplementation(() => {
      callOrder.push('unlink');
      return Promise.resolve();
    });

    await service.correctUser(1, 'tok');

    expect(client.deleteSessions).toHaveBeenCalledWith(1, 'tok', ['ext-100']);
    expect(sessionsRepo.unlinkSessions).toHaveBeenCalledWith(1, [100]);
    expect(callOrder).toEqual(['delete', 'unlink']);
  });

  it('treats a not_found delete result as already gone and unlinks it', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.deleteSessions as any).mockResolvedValueOnce([{ id: 'ext-100', status: 'error', error: { code: 'not_found' } }]);

    await service.correctUser(1, 'tok');

    expect(sessionsRepo.unlinkSessions).toHaveBeenCalledWith(1, [100]);
  });

  it('keeps the link when a delete result errors for a reason other than not_found', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.deleteSessions as any).mockResolvedValueOnce([{ id: 'ext-100', status: 'error', error: { code: 'invalid_value' } }]);

    await service.correctUser(1, 'tok');

    expect(sessionsRepo.unlinkSessions).not.toHaveBeenCalled();
  });

  it('never unlinks when the delete outcome for the whole batch is unknown (network error, 5xx, bad shape)', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.deleteSessions as any).mockRejectedValueOnce(new Error('network timeout'));

    await service.correctUser(1, 'tok');

    expect(sessionsRepo.unlinkSessions).not.toHaveBeenCalled();
  });

  it('skips a session whose wall-clock gap is under the 60 second threshold', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({
        id: 100,
        externalId: 'ext-100',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        endedAt: new Date('2026-01-01T00:10:59Z'),
        durationSeconds: 600,
      }),
    ]);

    await service.correctUser(1, 'tok');

    expect(client.deleteSessions).not.toHaveBeenCalled();
  });

  it('corrects a session whose gap is exactly the 60 second threshold', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({
        id: 100,
        externalId: 'ext-100',
        startedAt: new Date('2026-01-01T00:00:00Z'),
        endedAt: new Date('2026-01-01T00:11:00Z'),
        durationSeconds: 600,
      }),
    ]);
    (client.deleteSessions as any).mockResolvedValueOnce([{ id: 'ext-100', status: 'deleted', error: null }]);

    await service.correctUser(1, 'tok');

    expect(client.deleteSessions).toHaveBeenCalledWith(1, 'tok', ['ext-100']);
  });

  it('skips a listening session even if it would otherwise show a gap', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', sessionType: 'listen', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);

    await service.correctUser(1, 'tok');

    expect(client.deleteSessions).not.toHaveBeenCalled();
  });

  it('resumes from the stored cursor instead of rescanning from the start', async () => {
    const { service, sessionsRepo, cacheStore } = makeService();
    cacheStore.set('1:readwise:sessions-correction-cursor', 500);

    await service.correctUser(1, 'tok');

    expect(sessionsRepo.findLinkedSessionsForCorrection).toHaveBeenCalledWith(1, 500, expect.any(Number));
  });

  it('marks the pass done once no more eligible rows are found, and a later run is a no-op', async () => {
    const { service, sessionsRepo, client, cacheStore } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([]);

    await service.correctUser(1, 'tok');

    expect(cacheStore.get('1:readwise:sessions-correction-done')).toBe(true);

    vi.clearAllMocks();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValue([
      linkedSession({ id: 999, externalId: 'ext-999', endedAt: new Date('2026-01-01T02:00:00Z'), durationSeconds: 1200 }),
    ]);

    await service.correctUser(1, 'tok');

    expect(sessionsRepo.findLinkedSessionsForCorrection).not.toHaveBeenCalled();
    expect(client.deleteSessions).not.toHaveBeenCalled();
  });

  it('stops and disables the connection on a 403', async () => {
    const { service, sessionsRepo, client, readwiseRepo } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.deleteSessions as any).mockRejectedValueOnce(new ReadwiseBooksForbiddenError());

    await service.correctUser(1, 'tok');

    expect(readwiseRepo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'no_readwise_books', enabled: false });
  });

  it('stops without disabling the connection on a 401', async () => {
    const { service, sessionsRepo, client, readwiseRepo } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.deleteSessions as any).mockRejectedValueOnce(new ReadwiseUnauthorizedError());

    await service.correctUser(1, 'tok');

    expect(readwiseRepo.upsertSettings).not.toHaveBeenCalled();
  });
});
