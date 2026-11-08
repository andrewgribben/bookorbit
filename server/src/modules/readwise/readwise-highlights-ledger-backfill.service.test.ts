import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadwiseHighlightsLedgerBackfillService } from './readwise-highlights-ledger-backfill.service';

const mockClient = { exportHighlights: vi.fn() };
const mockReadwiseRepo = { findAnnotationsByIds: vi.fn(), findUnlinkedAnnotationByText: vi.fn() };
const mockReadingServicesRepo = { recordItemLinks: vi.fn() };

function makeService() {
  return new ReadwiseHighlightsLedgerBackfillService(mockClient as any, mockReadwiseRepo as any, mockReadingServicesRepo as any);
}

describe('ReadwiseHighlightsLedgerBackfillService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReadwiseRepo.findAnnotationsByIds.mockResolvedValue([]);
    mockReadwiseRepo.findUnlinkedAnnotationByText.mockResolvedValue(undefined);
  });

  it('links highlights whose highlight_url carries a matching BookOrbit annotationId and text', async () => {
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
    expect(mockReadwiseRepo.findUnlinkedAnnotationByText).not.toHaveBeenCalled();
  });

  it('falls back to a content match on the same book when the annotationId text no longer matches', async () => {
    // Simulates a live instance restored from an earlier backup: id 7 locally now names a
    // different annotation than the one Readwise's URL was built from on another instance.
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
    mockReadwiseRepo.findAnnotationsByIds.mockResolvedValueOnce([{ id: 7, bookId: 10, text: 'an unrelated highlight' }]);
    mockReadwiseRepo.findUnlinkedAnnotationByText.mockResolvedValueOnce({ id: 42 });

    const result = await makeService().backfill(1, 'tok');

    expect(result).toEqual({ linked: 1, unmatched: 0 });
    expect(mockReadwiseRepo.findUnlinkedAnnotationByText).toHaveBeenCalledWith(1, 10, 'the spice');
    expect(mockReadingServicesRepo.recordItemLinks).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 1, provider: 'readwise', kind: 'highlight', localId: 42, externalId: '555' }),
    ]);
  });

  it('links by content when the url has no annotationId but does have a bookId', async () => {
    // A highlight pushed from a different BookOrbit instance - no local row with that id exists,
    // but the bookId in the url and the exact text identify the same local annotation.
    mockClient.exportHighlights.mockResolvedValueOnce({
      results: [
        {
          user_book_id: 1,
          title: 'Dune',
          author: 'Frank Herbert',
          highlights: [
            {
              id: 900,
              text: 'fear is the mind-killer',
              note: '',
              location: null,
              highlight_url: 'https://staging.example/book/10?tab=highlights',
              highlighted_at: null,
              updated: null,
            },
          ],
        },
      ],
      nextPageCursor: null,
    });
    mockReadwiseRepo.findUnlinkedAnnotationByText.mockResolvedValueOnce({ id: 88 });

    const result = await makeService().backfill(1, 'tok');

    expect(result).toEqual({ linked: 1, unmatched: 0 });
    expect(mockReadwiseRepo.findAnnotationsByIds).toHaveBeenCalledWith(1, []);
    expect(mockReadwiseRepo.findUnlinkedAnnotationByText).toHaveBeenCalledWith(1, 10, 'fear is the mind-killer');
    expect(mockReadingServicesRepo.recordItemLinks).toHaveBeenCalledWith([expect.objectContaining({ localId: 88, externalId: '900' })]);
  });

  it('counts unmatched when neither the id nor a content match resolves locally', async () => {
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

  it('counts unmatched when the highlight_url has no ids at all', async () => {
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

    await expect(makeService().backfill(1, 'tok')).resolves.toEqual({ linked: 0, unmatched: 1 });
    expect(mockReadwiseRepo.findAnnotationsByIds).toHaveBeenCalledWith(1, []);
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
