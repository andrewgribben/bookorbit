import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadwiseSessionsReconcileService } from './readwise-sessions-reconcile.service';

const mockClient = { listSessions: vi.fn() };
const mockReadwiseRepo = {};
const mockReadingServicesRepo = {
  findBookLinksForProvider: vi.fn(),
  recordItemLinks: vi.fn(),
};
const mockCache = { get: vi.fn(), set: vi.fn() };
const mockSessionsRepo = { findAllPushableSessions: vi.fn() };
const mockSyncRunService = { markReconciling: vi.fn(), clearReconciling: vi.fn() };

function makeService() {
  return new ReadwiseSessionsReconcileService(
    mockClient as any,
    mockReadwiseRepo as any,
    mockReadingServicesRepo as any,
    mockCache as any,
    mockSessionsRepo as any,
    mockSyncRunService as any,
  );
}

function session(partial: Partial<{ id: number; bookId: number; startedAt: Date; durationSeconds: number }>) {
  return {
    id: 1,
    bookId: 10,
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

describe('ReadwiseSessionsReconcileService', () => {
  // resetAllMocks (not clearAllMocks): leftover queued mockResolvedValueOnce values from a
  // prior test's unconsumed page must not bleed into the next test's call sequence.
  beforeEach(() => vi.resetAllMocks());

  it('is a no-op once already reconciled', async () => {
    mockCache.get.mockResolvedValueOnce(true);
    await makeService().ensureReconciled(1, 'tok');
    expect(mockReadingServicesRepo.findBookLinksForProvider).not.toHaveBeenCalled();
    expect(mockSyncRunService.markReconciling).not.toHaveBeenCalled();
  });

  it('marks and clears the reconciling phase around the pass', async () => {
    mockCache.get.mockResolvedValueOnce(undefined);
    mockReadingServicesRepo.findBookLinksForProvider.mockResolvedValueOnce([]);
    await makeService().ensureReconciled(7, 'tok');
    expect(mockSyncRunService.markReconciling).toHaveBeenCalledWith(7, 'readwise');
    expect(mockSyncRunService.clearReconciling).toHaveBeenCalledWith(7, 'readwise');
  });

  it('clears the reconciling phase even when the pass throws', async () => {
    mockCache.get.mockResolvedValueOnce(undefined);
    mockReadingServicesRepo.findBookLinksForProvider.mockRejectedValueOnce(new Error('boom'));
    await expect(makeService().ensureReconciled(9, 'tok')).rejects.toThrow('boom');
    expect(mockSyncRunService.markReconciling).toHaveBeenCalledWith(9, 'readwise');
    expect(mockSyncRunService.clearReconciling).toHaveBeenCalledWith(9, 'readwise');
  });

  it('does nothing when the user has no linked books yet', async () => {
    mockCache.get.mockResolvedValueOnce(undefined);
    mockReadingServicesRepo.findBookLinksForProvider.mockResolvedValueOnce([]);
    await makeService().ensureReconciled(1, 'tok');
    expect(mockClient.listSessions).not.toHaveBeenCalled();
    expect(mockCache.set).toHaveBeenCalledWith(1, 'readwise', 'sessions-reconciled', true, expect.any(Number));
  });

  it('links a local session to a matching remote session on the same book within tolerance', async () => {
    mockCache.get.mockResolvedValueOnce(undefined);
    mockReadingServicesRepo.findBookLinksForProvider.mockResolvedValueOnce([{ bookId: 10, externalBookId: 'ext-book-1' }]);
    mockClient.listSessions.mockResolvedValueOnce({
      results: [
        { id: 'ext-session-1', book_id: 'ext-book-1', started_at: '2026-01-01T00:00:10Z', ended_at: '2026-01-01T00:10:05Z', format: 'ebook' },
      ],
      next: null,
    });
    mockSessionsRepo.findAllPushableSessions
      .mockResolvedValueOnce([session({ id: 500, bookId: 10, startedAt: new Date('2026-01-01T00:00:00Z'), durationSeconds: 600 })])
      .mockResolvedValueOnce([]);

    await makeService().ensureReconciled(1, 'tok');

    expect(mockReadingServicesRepo.recordItemLinks).toHaveBeenCalledWith([
      { userId: 1, provider: 'readwise', kind: 'session', localId: 500, externalId: 'ext-session-1' },
    ]);
    expect(mockCache.set).toHaveBeenCalledWith(1, 'readwise', 'sessions-reconciled', true, expect.any(Number));
  });

  it('does not link when start time is outside tolerance', async () => {
    mockCache.get.mockResolvedValueOnce(undefined);
    mockReadingServicesRepo.findBookLinksForProvider.mockResolvedValueOnce([{ bookId: 10, externalBookId: 'ext-book-1' }]);
    mockClient.listSessions.mockResolvedValueOnce({
      results: [
        { id: 'ext-session-1', book_id: 'ext-book-1', started_at: '2026-01-01T05:00:00Z', ended_at: '2026-01-01T05:10:00Z', format: 'ebook' },
      ],
      next: null,
    });
    mockSessionsRepo.findAllPushableSessions
      .mockResolvedValueOnce([session({ id: 500, bookId: 10, startedAt: new Date('2026-01-01T00:00:00Z'), durationSeconds: 600 })])
      .mockResolvedValueOnce([]);

    await makeService().ensureReconciled(1, 'tok');

    expect(mockReadingServicesRepo.recordItemLinks).toHaveBeenCalledWith([]);
  });

  it('does not reuse the same remote session for two local sessions', async () => {
    mockCache.get.mockResolvedValueOnce(undefined);
    mockReadingServicesRepo.findBookLinksForProvider.mockResolvedValueOnce([{ bookId: 10, externalBookId: 'ext-book-1' }]);
    mockClient.listSessions.mockResolvedValueOnce({
      results: [
        { id: 'ext-session-1', book_id: 'ext-book-1', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:10:00Z', format: 'ebook' },
      ],
      next: null,
    });
    mockSessionsRepo.findAllPushableSessions
      .mockResolvedValueOnce([
        session({ id: 500, bookId: 10, startedAt: new Date('2026-01-01T00:00:00Z'), durationSeconds: 600 }),
        session({ id: 501, bookId: 10, startedAt: new Date('2026-01-01T00:00:05Z'), durationSeconds: 600 }),
      ])
      .mockResolvedValueOnce([]);

    await makeService().ensureReconciled(1, 'tok');

    expect(mockReadingServicesRepo.recordItemLinks).toHaveBeenCalledWith([
      { userId: 1, provider: 'readwise', kind: 'session', localId: 500, externalId: 'ext-session-1' },
    ]);
  });
});
