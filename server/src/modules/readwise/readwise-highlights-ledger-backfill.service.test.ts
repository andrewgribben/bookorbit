import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadwiseHighlightsLedgerBackfillService } from './readwise-highlights-ledger-backfill.service';

const mockClient = { exportHighlights: vi.fn() };
const mockReadwiseRepo = { findAnnotationsByIds: vi.fn() };
const mockReadingServicesRepo = { recordItemLinks: vi.fn() };

function makeService() {
  return new ReadwiseHighlightsLedgerBackfillService(mockClient as any, mockReadwiseRepo as any, mockReadingServicesRepo as any);
}

describe('ReadwiseHighlightsLedgerBackfillService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('links highlights whose highlight_url carries a matching BookOrbit annotationId', async () => {
    mockClient.exportHighlights.mockResolvedValueOnce({
      results: [
        {
          user_book_id: 1,
          title: 'Dune',
          author: 'Frank Herbert',
          highlights: [
            {
              id: 555,
              text: 'the spice',
              note: '',
              location: null,
              highlight_url: 'https://bookorbit.example/book/10?tab=highlights&annotationId=7',
              highlighted_at: null,
              updated: null,
            },
          ],
        },
      ],
      nextPageCursor: null,
    });
    mockReadwiseRepo.findAnnotationsByIds.mockResolvedValueOnce([{ id: 7, bookId: 10, text: 'the spice' }]);

    const result = await makeService().backfill(1, 'tok');

    expect(result).toEqual({ linked: 1, unmatched: 0 });
    expect(mockReadingServicesRepo.recordItemLinks).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 1, provider: 'readwise', kind: 'highlight', localId: 7, externalId: '555' }),
    ]);
  });

  it('counts unmatched when the annotation no longer exists locally', async () => {
    mockClient.exportHighlights.mockResolvedValueOnce({
      results: [
        {
          user_book_id: 1,
          title: 'Dune',
          author: null,
          highlights: [
            { id: 1, text: 't', note: '', location: null, highlight_url: 'https://x/book/1?annotationId=99', highlighted_at: null, updated: null },
          ],
        },
      ],
      nextPageCursor: null,
    });
    mockReadwiseRepo.findAnnotationsByIds.mockResolvedValueOnce([]);

    await expect(makeService().backfill(1, 'tok')).resolves.toEqual({ linked: 0, unmatched: 1 });
    expect(mockReadingServicesRepo.recordItemLinks).toHaveBeenCalledWith([]);
  });

  it('ignores highlights whose highlight_url has no annotationId (not pushed by BookOrbit)', async () => {
    mockClient.exportHighlights.mockResolvedValueOnce({
      results: [
        {
          user_book_id: 1,
          title: 'Dune',
          author: null,
          highlights: [{ id: 1, text: 't', note: '', location: null, highlight_url: null, highlighted_at: null, updated: null }],
        },
      ],
      nextPageCursor: null,
    });

    await expect(makeService().backfill(1, 'tok')).resolves.toEqual({ linked: 0, unmatched: 0 });
    expect(mockReadwiseRepo.findAnnotationsByIds).not.toHaveBeenCalled();
  });

  it('pages through the export until nextPageCursor is null', async () => {
    mockClient.exportHighlights
      .mockResolvedValueOnce({ results: [], nextPageCursor: 'page-2' })
      .mockResolvedValueOnce({ results: [], nextPageCursor: null });

    await makeService().backfill(1, 'tok');

    expect(mockClient.exportHighlights).toHaveBeenCalledTimes(2);
    expect(mockClient.exportHighlights.mock.calls[1][2]).toEqual(expect.objectContaining({ pageCursor: 'page-2' }));
  });
});
