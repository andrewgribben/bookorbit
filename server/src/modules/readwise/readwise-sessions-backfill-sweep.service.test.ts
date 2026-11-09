import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadwiseSessionsBackfillSweepService } from './readwise-sessions-backfill-sweep.service';
import type { PushableSessionWithBook } from './readwise-sessions-local.repository';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';

function pushableSession(partial: Partial<PushableSessionWithBook> & { id: number; bookId: number }): PushableSessionWithBook {
  return {
    bookFileId: 1,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    endedAt: new Date('2026-01-01T00:10:00Z'),
    durationSeconds: 600,
    endProgress: 50,
    progressDelta: 5,
    sessionType: 'read',
    source: 'web',
    ...partial,
  };
}

function makeService() {
  const sessionsRepo = {
    findAllPushableSessions: vi.fn().mockResolvedValue([]),
  } as unknown as ReadwiseSessionsLocalRepository;
  const cacheStore = new Map<string, unknown>();
  const cache = {
    get: vi.fn((userId: number, provider: string, key: string) => Promise.resolve(cacheStore.get(`${userId}:${provider}:${key}`) ?? null)),
    set: vi.fn((userId: number, provider: string, key: string, value: unknown) => {
      cacheStore.set(`${userId}:${provider}:${key}`, value);
      return Promise.resolve();
    }),
  } as unknown as ReadingServiceCacheService;

  const service = new ReadwiseSessionsBackfillSweepService(sessionsRepo, cache);
  return { service, sessionsRepo, cache, cacheStore };
}

describe('ReadwiseSessionsBackfillSweepService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns distinct book ids for settled pushable sessions', async () => {
    const { service, sessionsRepo } = makeService();
    (sessionsRepo.findAllPushableSessions as any).mockResolvedValueOnce([
      pushableSession({ id: 1, bookId: 10 }),
      pushableSession({ id: 2, bookId: 10 }),
      pushableSession({ id: 3, bookId: 20 }),
    ]);

    const bookIds = await service.ensureSwept(1);

    expect(bookIds.sort()).toEqual([10, 20]);
  });

  it('excludes a koreader session that has not settled yet', async () => {
    const { service, sessionsRepo } = makeService();
    (sessionsRepo.findAllPushableSessions as any).mockResolvedValueOnce([
      pushableSession({ id: 1, bookId: 10, source: 'koreader', endedAt: new Date(Date.now() - 60_000) }),
    ]);

    const bookIds = await service.ensureSwept(1);

    expect(bookIds).toEqual([]);
  });

  it('includes a koreader session once it has settled', async () => {
    const { service, sessionsRepo } = makeService();
    (sessionsRepo.findAllPushableSessions as any).mockResolvedValueOnce([
      pushableSession({ id: 1, bookId: 10, source: 'koreader', endedAt: new Date(Date.now() - 2000 * 1000) }),
    ]);

    const bookIds = await service.ensureSwept(1);

    expect(bookIds).toEqual([10]);
  });

  it('resumes from the stored cursor instead of rescanning from the start', async () => {
    const { service, sessionsRepo, cacheStore } = makeService();
    cacheStore.set('1:readwise:sessions-sweep-cursor', 500);

    await service.ensureSwept(1);

    expect(sessionsRepo.findAllPushableSessions).toHaveBeenCalledWith(1, 60, 500, expect.any(Number));
  });

  it('marks the pass done once no more rows are found, and a later run is a no-op', async () => {
    const { service, sessionsRepo, cacheStore } = makeService();
    (sessionsRepo.findAllPushableSessions as any).mockResolvedValueOnce([]);

    await service.ensureSwept(1);

    expect(cacheStore.get('1:readwise:sessions-sweep-done')).toBe(true);

    vi.clearAllMocks();
    (sessionsRepo.findAllPushableSessions as any).mockResolvedValue([pushableSession({ id: 99, bookId: 99 })]);

    const bookIds = await service.ensureSwept(1);

    expect(sessionsRepo.findAllPushableSessions).not.toHaveBeenCalled();
    expect(bookIds).toEqual([]);
  });

  it('is bounded to a few pages per run', async () => {
    const { service, sessionsRepo } = makeService();
    const fullPage = Array.from({ length: 200 }, (_, i) => pushableSession({ id: i + 1, bookId: i + 1 }));
    (sessionsRepo.findAllPushableSessions as any).mockResolvedValue(fullPage);

    await service.ensureSwept(1);

    expect((sessionsRepo.findAllPushableSessions as any).mock.calls.length).toBe(3);
  });
});
