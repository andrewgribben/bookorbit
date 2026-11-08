import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ReadwiseUnauthorizedError } from './readwise-client.service';
import { READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE, READWISE_MAX } from './readwise.constants';
import { ReadwiseSyncService } from './readwise-sync.service';
import type { LinkedHighlightRow, NewHighlightRow } from './readwise.repository';

const mockRepo = {
  findSettings: vi.fn(),
  userHasReadwiseSyncPermission: vi.fn(),
  findPushableHighlights: vi.fn(),
  findChangedLinkedHighlights: vi.fn(),
  findDeletedLinkedHighlights: vi.fn(),
  upsertSettings: vi.fn(),
};

const mockClient = {
  createHighlights: vi.fn(),
  updateHighlight: vi.fn(),
  deleteHighlight: vi.fn(),
};

const mockSettingsService = {
  getToken: vi.fn(),
};

const mockReadingServicesRepo = {
  recordItemLinks: vi.fn(),
  updateItemLinkContentHash: vi.fn(),
  markItemLinkDeleted: vi.fn(),
};

const mockCache = {
  get: vi.fn(),
  set: vi.fn(),
};

const mockLedgerBackfill = {
  backfill: vi.fn(),
};

function makeService() {
  return new ReadwiseSyncService(
    mockRepo as any,
    mockClient as any,
    mockSettingsService as any,
    mockReadingServicesRepo as any,
    mockCache as any,
    mockLedgerBackfill as any,
    { appUrl: 'https://bookorbit.example/' } as any,
  );
}

function makeRow(overrides: Partial<NewHighlightRow> = {}): NewHighlightRow {
  return {
    annotationId: 1,
    bookId: 10,
    text: 'a highlight',
    note: 'a note',
    createdAt: new Date('2026-01-02T03:04:05.000Z'),
    title: 'A Book',
    author: 'An Author',
    isbn13: null,
    isbn10: null,
    ...overrides,
  };
}

function makeLinkedRow(overrides: Partial<LinkedHighlightRow> = {}): LinkedHighlightRow {
  return { ...makeRow(), externalId: '555', contentHash: 'stale-hash', ...overrides };
}

function enabledSettings(overrides: Record<string, unknown> = {}) {
  return { apiToken: 'tok', enabled: true, ...overrides };
}

describe('ReadwiseSyncService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRepo.userHasReadwiseSyncPermission.mockResolvedValue(true);
    mockRepo.findPushableHighlights.mockResolvedValue([]);
    mockRepo.findChangedLinkedHighlights.mockResolvedValue([]);
    mockRepo.findDeletedLinkedHighlights.mockResolvedValue([]);
    mockClient.createHighlights.mockResolvedValue([]);
    mockRepo.upsertSettings.mockResolvedValue(undefined);
    mockSettingsService.getToken.mockResolvedValue('tok');
    mockCache.get.mockResolvedValue(true); // ledger already backfilled by default
    mockCache.set.mockResolvedValue(undefined);
  });

  describe('flush guards', () => {
    it('skips when no settings row', async () => {
      mockRepo.findSettings.mockResolvedValue(undefined);
      await makeService().flush(1);
      expect(mockClient.createHighlights).not.toHaveBeenCalled();
      expect(mockRepo.findPushableHighlights).not.toHaveBeenCalled();
    });

    it('skips when token missing', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings({ apiToken: null }));
      mockSettingsService.getToken.mockResolvedValue(null);
      await makeService().flush(1);
      expect(mockClient.createHighlights).not.toHaveBeenCalled();
    });

    it('skips when enabled=false', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings({ enabled: false }));
      await makeService().flush(1);
      expect(mockClient.createHighlights).not.toHaveBeenCalled();
    });

    it('skips when no permission', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      mockRepo.userHasReadwiseSyncPermission.mockResolvedValue(false);
      await makeService().flush(1);
      expect(mockClient.createHighlights).not.toHaveBeenCalled();
      expect(mockRepo.findPushableHighlights).not.toHaveBeenCalled();
    });
  });

  describe('ledger backfill', () => {
    it('runs the backfill once when not yet done, and flags it done afterwards', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      mockCache.get.mockResolvedValue(null);
      await makeService().flush(1);
      expect(mockLedgerBackfill.backfill).toHaveBeenCalledWith(1, 'tok');
      expect(mockCache.set).toHaveBeenCalledWith(1, 'readwise', 'highlights-ledger-backfilled', true, expect.any(Number));
    });

    it('skips the backfill when already done', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      mockCache.get.mockResolvedValue(true);
      await makeService().flush(1);
      expect(mockLedgerBackfill.backfill).not.toHaveBeenCalled();
    });
  });

  describe('create push', () => {
    it('maps a row to a ReadwiseHighlight and records the ledger from the returned id', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      mockRepo.findPushableHighlights.mockResolvedValueOnce([makeRow({ annotationId: 5 })]).mockResolvedValueOnce([]);
      mockClient.createHighlights.mockResolvedValueOnce([999]);
      await makeService().flush(1);

      const [, , payload] = mockClient.createHighlights.mock.calls[0];
      expect(payload[0]).toEqual({
        text: 'a highlight',
        title: 'A Book',
        author: 'An Author',
        note: 'a note',
        highlighted_at: '2026-01-02T03:04:05.000Z',
        highlight_url: 'https://bookorbit.example/book/10?tab=highlights&annotationId=5',
        source_type: 'bookorbit',
        category: 'books',
      });
      expect(mockReadingServicesRepo.recordItemLinks).toHaveBeenCalledWith([
        expect.objectContaining({ userId: 1, provider: 'readwise', kind: 'highlight', localId: 5, externalId: '999' }),
      ]);
    });

    it('truncates text/title/author/note to their max lengths', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      const row = makeRow({
        annotationId: 5,
        text: 'x'.repeat(READWISE_MAX.TEXT + 100),
        title: 't'.repeat(READWISE_MAX.TITLE + 100),
        author: 'a'.repeat(READWISE_MAX.AUTHOR + 100),
        note: 'n'.repeat(READWISE_MAX.NOTE + 100),
      });
      mockRepo.findPushableHighlights.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
      mockClient.createHighlights.mockResolvedValueOnce([1]);
      await makeService().flush(1);
      const h = mockClient.createHighlights.mock.calls[0][2][0];
      expect(h.text.length).toBe(READWISE_MAX.TEXT);
      expect(h.title.length).toBe(READWISE_MAX.TITLE);
      expect(h.author.length).toBe(READWISE_MAX.AUTHOR);
      expect(h.note.length).toBe(READWISE_MAX.NOTE);
    });

    it('does not re-record a highlight the create call failed to return an id for', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      mockRepo.findPushableHighlights.mockResolvedValueOnce([makeRow({ annotationId: 5 }), makeRow({ annotationId: 6 })]);
      mockClient.createHighlights.mockResolvedValueOnce([999]); // only one id for two highlights
      await makeService().flush(1);
      expect(mockReadingServicesRepo.recordItemLinks).toHaveBeenCalledWith([expect.objectContaining({ localId: 5, externalId: '999' })]);
    });

    it('loops again on a full page, stops on a partial page', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      const fullPage = Array.from({ length: READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE }, (_, i) => makeRow({ annotationId: i + 1 }));
      mockRepo.findPushableHighlights
        .mockResolvedValueOnce(fullPage)
        .mockResolvedValueOnce([makeRow({ annotationId: READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE + 5 })]);
      mockClient.createHighlights
        .mockResolvedValueOnce(fullPage.map((_, i) => i + 1))
        .mockResolvedValueOnce([READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE + 5]);
      await makeService().flush(1);
      expect(mockRepo.findPushableHighlights).toHaveBeenCalledTimes(2);
      expect(mockClient.createHighlights).toHaveBeenCalledTimes(2);
    });
  });

  describe('update push', () => {
    it('pushes only highlights whose content hash no longer matches, and advances the content hash', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      const unchanged = makeLinkedRow({ annotationId: 1, contentHash: 'sha-will-not-match-anyway' });
      const changed = makeLinkedRow({ annotationId: 2, externalId: '777', text: 'edited text' });
      mockRepo.findChangedLinkedHighlights.mockResolvedValueOnce([unchanged, changed]).mockResolvedValueOnce([]);
      await makeService().flush(1);
      expect(mockClient.updateHighlight).toHaveBeenCalledTimes(2); // both rows differ from their stale stub hash
      expect(mockClient.updateHighlight).toHaveBeenCalledWith(1, 'tok', '777', { text: 'edited text', note: 'a note' });
      expect(mockReadingServicesRepo.updateItemLinkContentHash).toHaveBeenCalledWith(1, 'readwise', 'highlight', 2, expect.any(String));
    });

    it('does not push when the content hash already matches (echo suppression)', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      const { readwiseHighlightContentHash } = await import('./readwise-highlight-hash.utils');
      const row = makeLinkedRow({ annotationId: 3, text: 'same', note: null });
      row.contentHash = readwiseHighlightContentHash('same', null);
      mockRepo.findChangedLinkedHighlights.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
      await makeService().flush(1);
      expect(mockClient.updateHighlight).not.toHaveBeenCalled();
    });

    it('advances the cursor past unchanged rows so it terminates', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      const fullPage = Array.from({ length: READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE }, (_, i) => makeLinkedRow({ annotationId: i + 1 }));
      mockRepo.findChangedLinkedHighlights.mockResolvedValueOnce(fullPage).mockResolvedValueOnce([]);
      await makeService().flush(1);
      expect(mockRepo.findChangedLinkedHighlights.mock.calls[1][1]).toBe(READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE);
    });
  });

  describe('delete push', () => {
    it('deletes remotely and marks the ledger link deleted for each soft-deleted local annotation', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      mockRepo.findDeletedLinkedHighlights.mockResolvedValueOnce([{ annotationId: 9, externalId: '321' }]).mockResolvedValueOnce([]);
      await makeService().flush(1);
      expect(mockClient.deleteHighlight).toHaveBeenCalledWith(1, 'tok', '321');
      expect(mockReadingServicesRepo.markItemLinkDeleted).toHaveBeenCalledWith(1, 'readwise', 'highlight', 9);
    });
  });

  describe('failure handling', () => {
    it('propagates a generic push error for the scheduler to retry', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      mockRepo.findPushableHighlights.mockResolvedValueOnce([makeRow({ annotationId: 9 })]);
      mockClient.createHighlights.mockRejectedValueOnce(new Error('boom'));
      await expect(makeService().flush(1)).rejects.toThrow('boom');
    });

    it('auto-disables on ReadwiseUnauthorizedError', async () => {
      mockRepo.findSettings.mockResolvedValue(enabledSettings());
      mockRepo.findPushableHighlights.mockResolvedValueOnce([makeRow({ annotationId: 9 })]);
      mockClient.createHighlights.mockRejectedValueOnce(new ReadwiseUnauthorizedError());
      await makeService().flush(1);
      expect(mockRepo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'invalid_token', enabled: false });
    });
  });
});
