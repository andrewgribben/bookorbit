import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import { ReadwiseQueueService } from './readwise-queue.service';
import { READWISE_BOOKS_URL, READWISE_SESSIONS_BY_DAY_URL, READWISE_SESSIONS_URL, READWISE_STATS_SUMMARY_URL } from './readwise.constants';

vi.mock('./readwise-queue.service');

const mockQueueService = {
  throttle: vi.fn().mockResolvedValue(undefined),
  resetUser: vi.fn(),
};

function makeFetchResponse(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: vi.fn().mockResolvedValue(body),
    headers: { get: (name: string) => headers[name] ?? null },
  } as unknown as Response;
}

describe('ReadwiseBooksClientService', () => {
  let service: ReadwiseBooksClientService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockQueueService.throttle.mockClear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    service = new ReadwiseBooksClientService(mockQueueService as unknown as ReadwiseQueueService);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('listBooks', () => {
    it('builds the exact URL and query parameter names', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200, { results: [], next: null }));
      await service.listBooks(1, 'tok', { updatedAfter: '2026-01-01', order: 'updated', cursor: 'abc', limit: 1000 });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${READWISE_BOOKS_URL}?updated_after=2026-01-01&order=updated&cursor=abc&limit=1000`);
      expect(init.method).toBe('GET');
      expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('joins ids and isbns with commas', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200, { results: [], next: null }));
      await service.getBooksByIsbns(1, 'tok', ['111', '222']);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${READWISE_BOOKS_URL}?isbns=111%2C222`);
    });

    it('calls queue.throttle before fetching', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200, { results: [], next: null }));
      await service.listBooks(7, 'tok');
      expect(mockQueueService.throttle).toHaveBeenCalledWith(7);
    });
  });

  describe('createBooks', () => {
    it('returns early without fetching for an empty batch', async () => {
      await service.createBooks(1, 'tok', []);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('posts items to the books URL and returns the result items', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200, { items: [{ id: '1', status: 'created' }] }));
      const result = await service.createBooks(1, 'tok', [{ product: { title: 'A Book' }, status: 'want_to_read' }]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(READWISE_BOOKS_URL);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body)).toEqual({ items: [{ product: { title: 'A Book' }, status: 'want_to_read' }] });
      expect(result).toEqual([{ id: '1', status: 'created' }]);
    });
  });

  describe('updateBooks', () => {
    it('sends a PATCH to the books URL', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200, { items: [{ id: '1', status: 'existing' }] }));
      await service.updateBooks(1, 'tok', [{ id: '1', status: 'finished' }]);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(READWISE_BOOKS_URL);
      expect(init.method).toBe('PATCH');
    });
  });

  describe('error handling', () => {
    it('throws ReadwiseBooksForbiddenError on 403', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(403));
      await expect(service.listBooks(1, 'tok')).rejects.toBeInstanceOf(ReadwiseBooksForbiddenError);
    });

    it('throws ReadwiseUnauthorizedError on 401', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(401));
      await expect(service.listBooks(1, 'tok')).rejects.toBeInstanceOf(ReadwiseUnauthorizedError);
    });

    it('honours Retry-After on 429 and then succeeds', async () => {
      fetchMock
        .mockResolvedValueOnce(makeFetchResponse(429, {}, { 'Retry-After': '2' }))
        .mockResolvedValueOnce(makeFetchResponse(200, { results: [], next: null }));
      const p = service.listBooks(1, 'tok');
      await vi.advanceTimersByTimeAsync(2000);
      await expect(p).resolves.toEqual({ results: [], next: null });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('gives up after max retries on repeated 429s', async () => {
      fetchMock.mockResolvedValue(makeFetchResponse(429));
      const p = service.listBooks(1, 'tok');
      const expectation = expect(p).rejects.toThrow('Readwise Books rate limit exceeded');
      await vi.runAllTimersAsync();
      await expectation;
    });

    it('throws on an unexpected status', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(500));
      await expect(service.listBooks(1, 'tok')).rejects.toThrow('Readwise Books API error: 500');
    });
  });

  describe('sessions and stats', () => {
    it('builds the sessions URL with include_deleted', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200, { results: [], next: null }));
      await service.listSessions(1, 'tok', { includeDeleted: true, updatedAfter: '2026-01-01' });
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${READWISE_SESSIONS_URL}?updated_after=2026-01-01&include_deleted=true`);
    });

    it('posts sessions and returns created ids', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200, { items: [{ id: 's1' }] }));
      const result = await service.createSessions(1, 'tok', [
        { book_id: 'b1', started_at: '2026-01-01T00:00:00Z', ended_at: '2026-01-01T00:30:00Z', format: 'ebook' },
      ]);
      expect(result).toEqual([{ id: 's1' }]);
    });

    it('builds the stats summary URL with period and year', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200, { books_finished: 5 }));
      await service.statsSummary(1, 'tok', 2026);
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${READWISE_STATS_SUMMARY_URL}?period=year&year=2026`);
    });

    it('builds the sessions-by-day URL with from/to', async () => {
      fetchMock.mockResolvedValueOnce(makeFetchResponse(200, { results: [] }));
      await service.sessionsByDay(1, 'tok', '2026-01-01', '2026-02-01');
      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe(`${READWISE_SESSIONS_BY_DAY_URL}?from=2026-01-01&to=2026-02-01`);
    });
  });
});
