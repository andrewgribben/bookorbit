import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./readwise.constants', async () => {
  const actual = await vi.importActual<typeof import('./readwise.constants')>('./readwise.constants');
  return { ...actual, READWISE_SESSIONS_CORRECTION_ENABLED: true };
});

import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError, ReadwiseBooksHttpError } from './readwise-books-client.service';
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
  const client = { updateSessions: vi.fn() } as unknown as ReadwiseBooksClientService;
  const sessionsRepo = { findLinkedSessionsForCorrection: vi.fn().mockResolvedValue([]) } as unknown as ReadwiseSessionsLocalRepository;
  const readwiseRepo = { upsertSettings: vi.fn() } as unknown as ReadwiseRepository;
  const cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn() } as unknown as ReadingServiceCacheService;

  const service = new ReadwiseSessionsCorrectionService(client, sessionsRepo, readwiseRepo, cache);
  return { service, client, sessionsRepo, readwiseRepo, cache };
}

describe('ReadwiseSessionsCorrectionService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('computes the same paused_seconds the push path would have sent', async () => {
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
    (client.updateSessions as any).mockResolvedValueOnce([{ id: 'ext-100' }]);

    await service.correctUser(1, 'tok');

    expect(client.updateSessions).toHaveBeenCalledWith(1, 'tok', [{ id: 'ext-100', paused_seconds: 2400 }]);
  });

  it('skips a session whose computed paused_seconds is zero', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([linkedSession({ id: 100, externalId: 'ext-100' })]);

    await service.correctUser(1, 'tok');

    expect(client.updateSessions).not.toHaveBeenCalled();
  });

  it('skips listening sessions even if they would otherwise show a gap', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', sessionType: 'listen', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);

    await service.correctUser(1, 'tok');

    expect(client.updateSessions).not.toHaveBeenCalled();
  });

  it('never calls createSessions (PATCH only, never re-POST)', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.updateSessions as any).mockResolvedValueOnce([{ id: 'ext-100' }]);

    await service.correctUser(1, 'tok');

    expect((client as any).createSessions).toBeUndefined();
    expect(client.updateSessions).toHaveBeenCalledTimes(1);
  });

  it('resumes from the stored cursor instead of rescanning from the start', async () => {
    const { service, sessionsRepo, cache } = makeService();
    (cache.get as any).mockResolvedValueOnce(500);

    await service.correctUser(1, 'tok');

    expect(sessionsRepo.findLinkedSessionsForCorrection).toHaveBeenCalledWith(1, 500, expect.any(Number));
  });

  it('is idempotent: a second run after the cursor caught up patches nothing', async () => {
    const { service, sessionsRepo, client, cache } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.updateSessions as any).mockResolvedValueOnce([{ id: 'ext-100' }]);

    await service.correctUser(1, 'tok');
    expect(cache.set).toHaveBeenCalledWith(1, 'readwise', 'sessions-correction-cursor', 100, expect.any(Number));

    vi.clearAllMocks();
    (cache.get as any).mockResolvedValueOnce(100);
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([]);

    await service.correctUser(1, 'tok');

    expect(client.updateSessions).not.toHaveBeenCalled();
  });

  it('stops and disables the connection on a 403', async () => {
    const { service, sessionsRepo, client, readwiseRepo } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.updateSessions as any).mockRejectedValueOnce(new ReadwiseBooksForbiddenError());

    await service.correctUser(1, 'tok');

    expect(readwiseRepo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'no_readwise_books', enabled: false });
  });

  it('stops without disabling the connection on a 401', async () => {
    const { service, sessionsRepo, client, readwiseRepo } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.updateSessions as any).mockRejectedValueOnce(new ReadwiseUnauthorizedError());

    await service.correctUser(1, 'tok');

    expect(readwiseRepo.upsertSettings).not.toHaveBeenCalled();
  });

  it('retries a failed batch session by session on a 4xx instead of dropping the whole batch', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
      linkedSession({ id: 101, externalId: 'ext-101', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.updateSessions as any)
      .mockRejectedValueOnce(new ReadwiseBooksHttpError('PATCH', '/books/api/v1/sessions', 400, ''))
      .mockResolvedValueOnce([{ id: 'ext-100' }])
      .mockRejectedValueOnce(new ReadwiseBooksHttpError('PATCH', '/books/api/v1/sessions', 400, ''));

    await service.correctUser(1, 'tok');

    expect(client.updateSessions).toHaveBeenCalledTimes(3);
  });

  it('does not retry a batch when the outcome is unknown (e.g. timeout, 5xx)', async () => {
    const { service, sessionsRepo, client } = makeService();
    (sessionsRepo.findLinkedSessionsForCorrection as any).mockResolvedValueOnce([
      linkedSession({ id: 100, externalId: 'ext-100', endedAt: new Date('2026-01-01T01:00:00Z'), durationSeconds: 1200 }),
    ]);
    (client.updateSessions as any).mockRejectedValueOnce(new Error('network timeout'));

    await service.correctUser(1, 'tok');

    expect(client.updateSessions).toHaveBeenCalledTimes(1);
  });
});
