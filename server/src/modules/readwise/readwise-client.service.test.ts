import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ReadwiseClientService, ReadwiseUnauthorizedError, type ReadwiseHighlight } from './readwise-client.service';
import { ReadwiseQueueService } from './readwise-queue.service';
import { READWISE_HIGHLIGHTS_URL } from './readwise.constants';

vi.mock('./readwise-queue.service');

const mockQueueService = {
  throttle: vi.fn().mockResolvedValue(undefined),
  resetUser: vi.fn(),
};

function makeFetchResponse(status: number): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: vi.fn().mockReturnValue(null) },
    json: vi.fn().mockResolvedValue({}),
  } as unknown as Response;
}

function makeHighlight(text = 'a note'): ReadwiseHighlight {
  return {
    text,
    title: 'A Book',
    author: 'An Author',
    source_type: 'bookorbit',
    category: 'books',
  };
}

describe('ReadwiseClientService', () => {
  let service: ReadwiseClientService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockQueueService.throttle.mockClear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service = new ReadwiseClientService(mockQueueService as unknown as ReadwiseQueueService);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('validateToken', () => {
    it('returns true on 204', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(204));
      await expect(service.validateToken(1, 'tok')).resolves.toBe(true);
      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('returns false on 401', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(401));
      await expect(service.validateToken(1, 'tok')).resolves.toBe(false);
    });

    it('returns false when fetch throws', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      await expect(service.validateToken(1, 'tok')).resolves.toBe(false);
    });
  });

  describe('createHighlights', () => {
    it('returns early without fetching when highlights array is empty', async () => {
      await service.createHighlights(1, 'tok', []);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mockQueueService.throttle).not.toHaveBeenCalled();
    });

    it('posts to the highlights URL with correct headers and body', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200));
      const highlights = [makeHighlight()];
      await service.createHighlights(1, 'tok', highlights);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(READWISE_HIGHLIGHTS_URL);
      expect(init.method).toBe('POST');
      expect(init.headers.Authorization).toBe('Token tok');
      expect(init.headers['Content-Type']).toBe('application/json');
      expect(init.body).toBe(JSON.stringify({ highlights }));
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it('calls queue.throttle before fetching', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200));
      await service.createHighlights(7, 'tok', [makeHighlight()]);
      expect(mockQueueService.throttle).toHaveBeenCalledWith(7);
      const throttleOrder = mockQueueService.throttle.mock.invocationCallOrder[0];
      const fetchOrder = fetchMock.mock.invocationCallOrder[0];
      expect(throttleOrder).toBeLessThan(fetchOrder);
    });

    it('backs off and retries on 429, giving up after max retries', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse(429));
      const p = service.createHighlights(1, 'tok', [makeHighlight()]);
      const expectation = expect(p).rejects.toThrow('Readwise rate limit exceeded');
      await vi.runAllTimersAsync();
      await expectation;
      expect(fetchMock).toHaveBeenCalledTimes(4); // 1 + 3 retries
    });

    it('succeeds when a 429 is followed by a 200', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(429)).mockResolvedValueOnce(makeFetchResponse(200));
      const p = service.createHighlights(1, 'tok', [makeHighlight()]);
      await vi.runAllTimersAsync();
      await expect(p).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws ReadwiseUnauthorizedError on 401', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(401));
      await expect(service.createHighlights(1, 'tok', [makeHighlight()])).rejects.toBeInstanceOf(ReadwiseUnauthorizedError);
    });

    it('throws on 500', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(500));
      await expect(service.createHighlights(1, 'tok', [makeHighlight()])).rejects.toThrow('Readwise API error: 500');
    });

    it('rethrows network errors', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network failure'));
      await expect(service.createHighlights(1, 'tok', [makeHighlight()])).rejects.toThrow('Network failure');
    });

    it('extracts ids from a modified_highlights response', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: vi.fn().mockReturnValue(null) },
        json: vi.fn().mockResolvedValue({ modified_highlights: [101, 102] }),
      });
      await expect(service.createHighlights(1, 'tok', [makeHighlight(), makeHighlight()])).resolves.toEqual([101, 102]);
    });

    it('extracts ids from a per-book-group response, flattened in order', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: vi.fn().mockReturnValue(null) },
        json: vi.fn().mockResolvedValue([{ id: 'b1', highlights: [{ id: 201 }] }, { id: 'b2', highlights: [{ id: 202 }] }]),
      });
      await expect(service.createHighlights(1, 'tok', [makeHighlight(), makeHighlight()])).resolves.toEqual([201, 202]);
    });

    it('returns an empty array for an unrecognised response shape', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: vi.fn().mockReturnValue(null) },
        json: vi.fn().mockResolvedValue({ unexpected: true }),
      });
      await expect(service.createHighlights(1, 'tok', [makeHighlight()])).resolves.toEqual([]);
    });
  });

  describe('updateHighlight', () => {
    it('PATCHes the highlight detail URL with the patch body', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200));
      await service.updateHighlight(1, 'tok', '55', { note: 'edited' });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://readwise.io/api/v2/highlights/55/');
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe(JSON.stringify({ note: 'edited' }));
    });
  });

  describe('deleteHighlight', () => {
    it('DELETEs the highlight detail URL', async () => {
      fetchMock.mockResolvedValueOnce({ status: 204, ok: true, headers: { get: vi.fn().mockReturnValue(null) } });
      await service.deleteHighlight(1, 'tok', '55');
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://readwise.io/api/v2/highlights/55/');
      expect(init.method).toBe('DELETE');
    });
  });

  describe('exportHighlights', () => {
    it('builds the query string and returns results/nextPageCursor', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: vi.fn().mockReturnValue(null) },
        json: vi.fn().mockResolvedValue({ results: [{ user_book_id: 1, title: 'A', author: 'B', highlights: [] }], nextPageCursor: 'next' }),
      });
      const result = await service.exportHighlights(1, 'tok', { updatedAfter: '2026-01-01T00:00:00Z', includeDeleted: true });
      const [url] = fetchMock.mock.calls[0];
      expect(url).toContain('updatedAfter=2026-01-01');
      expect(url).toContain('includeDeleted=true');
      expect(result.nextPageCursor).toBe('next');
      expect(result.results).toHaveLength(1);
    });

    it('defaults to an empty page when the response has no results', async () => {
      fetchMock.mockResolvedValueOnce({
        status: 200,
        ok: true,
        headers: { get: vi.fn().mockReturnValue(null) },
        json: vi.fn().mockResolvedValue({}),
      });
      await expect(service.exportHighlights(1, 'tok')).resolves.toEqual({ results: [], nextPageCursor: null });
    });
  });
});
