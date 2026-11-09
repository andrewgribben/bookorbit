import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadwiseHighlightsPullService } from './readwise-highlights-pull.service';
import { readwiseHighlightContentHash } from './readwise-highlight-hash.utils';

const mockClient = { exportHighlights: vi.fn() };
const mockReadwiseRepo = { findConnectedUserIds: vi.fn() };
const mockReadwiseSettings = { getToken: vi.fn() };
const mockReadingServicesRepo = { findItemLinkByExternalId: vi.fn(), markItemLinkDeleted: vi.fn(), updateItemLinkContentHash: vi.fn() };
const mockFeaturesService = { getFeatures: vi.fn() };
const mockCache = { get: vi.fn(), set: vi.fn() };
const mockLocalRepo = { applyRemoteEdit: vi.fn(), applyRemoteDelete: vi.fn() };
const mockLock = {
  runExclusive: vi.fn((_op: string, _userId: number, fn: () => Promise<unknown>) => fn()),
};

function makeService() {
  return new ReadwiseHighlightsPullService(
    mockClient as any,
    mockReadwiseRepo as any,
    mockReadwiseSettings as any,
    mockReadingServicesRepo as any,
    mockFeaturesService as any,
    mockCache as any,
    mockLocalRepo as any,
    mockLock as any,
  );
}

function makeBookPage(highlights: Record<string, unknown>[]) {
  return { results: [{ user_book_id: 1, title: 'T', author: 'A', highlights }], nextPageCursor: null };
}

describe('ReadwiseHighlightsPullService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadwiseSettings.getToken.mockResolvedValue('tok');
    mockFeaturesService.getFeatures.mockResolvedValue({});
    mockCache.get.mockResolvedValue(null);
    mockCache.set.mockResolvedValue(undefined);
  });

  it('returns zero counters without a token', async () => {
    mockReadwiseSettings.getToken.mockResolvedValue(null);
    await expect(makeService().pullForUser(1)).resolves.toEqual({ edited: 0, deleted: 0, skippedNew: 0 });
    expect(mockClient.exportHighlights).not.toHaveBeenCalled();
  });

  it('returns zero counters when the highlights feature is disabled', async () => {
    mockFeaturesService.getFeatures.mockResolvedValue({ highlights: false });
    await expect(makeService().pullForUser(1)).resolves.toEqual({ edited: 0, deleted: 0, skippedNew: 0 });
    expect(mockClient.exportHighlights).not.toHaveBeenCalled();
  });

  it('returns zero counters when the advisory lock is already held', async () => {
    mockLock.runExclusive.mockResolvedValueOnce(null);
    await expect(makeService().pullForUser(1)).resolves.toEqual({ edited: 0, deleted: 0, skippedNew: 0 });
    expect(mockClient.exportHighlights).not.toHaveBeenCalled();
  });

  it('counts a remote highlight with no matching ledger link as skippedNew', async () => {
    mockClient.exportHighlights.mockResolvedValueOnce(
      makeBookPage([{ id: 1, text: 't', note: '', location: null, highlight_url: null, highlighted_at: null, updated: null }]),
    );
    mockReadingServicesRepo.findItemLinkByExternalId.mockResolvedValueOnce(undefined);

    await expect(makeService().pullForUser(1)).resolves.toEqual({ edited: 0, deleted: 0, skippedNew: 1 });
    expect(mockLocalRepo.applyRemoteEdit).not.toHaveBeenCalled();
  });

  it('applies a remote edit when the content hash differs from the ledger', async () => {
    mockClient.exportHighlights.mockResolvedValueOnce(
      makeBookPage([{ id: 1, text: 'edited remotely', note: 'n', location: null, highlight_url: null, highlighted_at: null, updated: null }]),
    );
    mockReadingServicesRepo.findItemLinkByExternalId.mockResolvedValueOnce({ localId: 9, contentHash: 'stale', deletedAt: null });
    mockLocalRepo.applyRemoteEdit.mockResolvedValueOnce(true);

    await expect(makeService().pullForUser(1)).resolves.toEqual({ edited: 1, deleted: 0, skippedNew: 0 });
    expect(mockLocalRepo.applyRemoteEdit).toHaveBeenCalledWith(1, 9, { text: 'edited remotely', note: 'n' });
    expect(mockReadingServicesRepo.updateItemLinkContentHash).toHaveBeenCalledWith(1, 'readwise', 'highlight', 9, expect.any(String));
  });

  it('is an echo-suppressing no-op when the content hash already matches', async () => {
    const hash = readwiseHighlightContentHash('same text', null);
    mockClient.exportHighlights.mockResolvedValueOnce(
      makeBookPage([{ id: 1, text: 'same text', note: '', location: null, highlight_url: null, highlighted_at: null, updated: null }]),
    );
    mockReadingServicesRepo.findItemLinkByExternalId.mockResolvedValueOnce({ localId: 9, contentHash: hash, deletedAt: null });

    await expect(makeService().pullForUser(1)).resolves.toEqual({ edited: 0, deleted: 0, skippedNew: 0 });
    expect(mockLocalRepo.applyRemoteEdit).not.toHaveBeenCalled();
  });

  it('applies a remote delete and marks the ledger link deleted', async () => {
    mockClient.exportHighlights.mockResolvedValueOnce(
      makeBookPage([{ id: 1, text: 't', note: '', location: null, highlight_url: null, highlighted_at: null, updated: null, is_deleted: true }]),
    );
    mockReadingServicesRepo.findItemLinkByExternalId.mockResolvedValueOnce({ localId: 9, contentHash: 'h', deletedAt: null });
    mockLocalRepo.applyRemoteDelete.mockResolvedValueOnce(true);

    await expect(makeService().pullForUser(1)).resolves.toEqual({ edited: 0, deleted: 1, skippedNew: 0 });
    expect(mockLocalRepo.applyRemoteDelete).toHaveBeenCalledWith(1, 9);
    expect(mockReadingServicesRepo.markItemLinkDeleted).toHaveBeenCalledWith(1, 'readwise', 'highlight', 9);
  });

  it('skips a link already marked deleted (already reconciled)', async () => {
    mockClient.exportHighlights.mockResolvedValueOnce(
      makeBookPage([{ id: 1, text: 't', note: '', location: null, highlight_url: null, highlighted_at: null, updated: null }]),
    );
    mockReadingServicesRepo.findItemLinkByExternalId.mockResolvedValueOnce({ localId: 9, contentHash: 'h', deletedAt: new Date() });

    await expect(makeService().pullForUser(1)).resolves.toEqual({ edited: 0, deleted: 0, skippedNew: 0 });
    expect(mockLocalRepo.applyRemoteEdit).not.toHaveBeenCalled();
    expect(mockLocalRepo.applyRemoteDelete).not.toHaveBeenCalled();
  });

  it('sets the pull cursor to the current time after a run', async () => {
    mockClient.exportHighlights.mockResolvedValueOnce(makeBookPage([]));
    await makeService().pullForUser(1);
    expect(mockCache.set).toHaveBeenCalledWith(1, 'readwise', 'highlights-pull-cursor', expect.any(String), expect.any(Number));
  });
});
