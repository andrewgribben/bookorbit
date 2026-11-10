import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseBooksClientService, ReadwiseBooksHttpError } from './readwise-books-client.service';
import { ReadwiseComicSeriesRepository } from './readwise-comic-series.repository';
import { ReadwiseComicSeriesService } from './readwise-comic-series.service';

function makeService() {
  const repo = {
    findSeriesForBook: vi.fn(),
    findEligibleIssues: vi.fn(),
    findSeriesBookLink: vi.fn(),
    upsertSeriesBookLink: vi.fn(),
    dropStaleSeriesBook: vi.fn(),
  } as unknown as ReadwiseComicSeriesRepository;
  const readingServicesRepo = {
    getLibrarySeriesModeEnabled: vi.fn(),
    findBookLink: vi.fn(),
    upsertBookLink: vi.fn(),
  } as unknown as ReadingServicesRepository;
  const client = { createBooks: vi.fn(), updateBooks: vi.fn() } as unknown as ReadwiseBooksClientService;

  const service = new ReadwiseComicSeriesService(repo, readingServicesRepo, client);
  return { service, repo, readingServicesRepo, client };
}

describe('ReadwiseComicSeriesService.resolveRouting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null for a book with no series', async () => {
    const { service, repo } = makeService();
    (repo.findSeriesForBook as any).mockResolvedValueOnce(null);
    expect(await service.resolveRouting(1, 10)).toBeNull();
  });

  it('returns null when the library has series mode off', async () => {
    const { service, repo, readingServicesRepo } = makeService();
    (repo.findSeriesForBook as any).mockResolvedValueOnce({ seriesId: 5, seriesName: 'Series', libraryId: 2 });
    (readingServicesRepo.getLibrarySeriesModeEnabled as any).mockResolvedValueOnce(false);
    expect(await service.resolveRouting(1, 10)).toBeNull();
  });

  it('returns null for an issue that already has its own individual link', async () => {
    const { service, repo, readingServicesRepo } = makeService();
    (repo.findSeriesForBook as any).mockResolvedValueOnce({ seriesId: 5, seriesName: 'Series', libraryId: 2 });
    (readingServicesRepo.getLibrarySeriesModeEnabled as any).mockResolvedValueOnce(true);
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({ matchMethod: 'isbn13' });
    expect(await service.resolveRouting(1, 10)).toBeNull();
  });

  it('queries every eligible issue of the series exactly once (no per-issue query loop)', async () => {
    const { service, repo, readingServicesRepo } = makeService();
    (repo.findSeriesForBook as any).mockResolvedValueOnce({ seriesId: 5, seriesName: 'Series', libraryId: 2 });
    (readingServicesRepo.getLibrarySeriesModeEnabled as any).mockResolvedValueOnce(true);
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce(undefined);
    (repo.findEligibleIssues as any).mockResolvedValueOnce([
      { bookId: 10, pageCount: 20, status: 'read', existingLinkExternalBookId: null, existingLinkMatchMethod: null },
      { bookId: 11, pageCount: 22, status: 'reading', existingLinkExternalBookId: null, existingLinkMatchMethod: null },
    ]);

    const context = await service.resolveRouting(1, 10);

    expect(repo.findEligibleIssues).toHaveBeenCalledTimes(1);
    expect(repo.findEligibleIssues).toHaveBeenCalledWith(1, 5, 2);
    expect(context?.totalPages).toBe(42);
    expect(context?.pageRanges.get(10)).toEqual({ pageOffset: 0, issuePages: 20 });
    expect(context?.pageRanges.get(11)).toEqual({ pageOffset: 20, issuePages: 22 });
    expect(context?.status).toBe('currently_reading');
  });
});

describe('ReadwiseComicSeriesService.ensureSeriesExternalBook', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not create the series book while no issue has had any activity', async () => {
    const { service, repo, client } = makeService();
    (repo.findSeriesBookLink as any).mockResolvedValueOnce(undefined);

    const result = await service.ensureSeriesExternalBook(
      1,
      'tok',
      {
        seriesId: 5,
        seriesName: 'Series',
        totalPages: 40,
        status: null,
        pageRanges: new Map(),
      },
      null,
    );

    expect(result).toBeNull();
    expect(client.createBooks).not.toHaveBeenCalled();
  });

  it('creates the series book with the series name, author hint and current total pages', async () => {
    const { service, repo, client } = makeService();
    (repo.findSeriesBookLink as any).mockResolvedValueOnce(undefined);
    (client.createBooks as any).mockResolvedValueOnce([{ id: 'r1', status: 'created', book_id: 'series-ext-1' }]);

    const result = await service.ensureSeriesExternalBook(
      1,
      'tok',
      {
        seriesId: 5,
        seriesName: 'Comic Series',
        totalPages: 40,
        status: 'currently_reading',
        pageRanges: new Map(),
      },
      'Author A',
    );

    expect(client.createBooks).toHaveBeenCalledWith(1, 'tok', [
      expect.objectContaining({ product: { title: 'Comic Series', author: 'Author A' }, status: 'currently_reading', manual_total_pages: 40 }),
    ]);
    expect(repo.upsertSeriesBookLink).toHaveBeenCalledWith(1, 5, { externalBookId: 'series-ext-1', totalPages: 40, status: 'currently_reading' });
    expect(result).toBe('series-ext-1');
  });

  it('raises manual_total_pages before the caller can push a session past the old total', async () => {
    const { service, repo, client } = makeService();
    (repo.findSeriesBookLink as any).mockResolvedValueOnce({ externalBookId: 'series-ext-1', totalPages: 20, status: 'currently_reading' });

    const result = await service.ensureSeriesExternalBook(
      1,
      'tok',
      {
        seriesId: 5,
        seriesName: 'Comic Series',
        totalPages: 40,
        status: 'currently_reading',
        pageRanges: new Map(),
      },
      null,
    );

    expect(client.updateBooks).toHaveBeenCalledWith(1, 'tok', [{ id: 'series-ext-1', manual_total_pages: 40, status: 'currently_reading' }]);
    expect(repo.upsertSeriesBookLink).toHaveBeenCalledWith(1, 5, { externalBookId: 'series-ext-1', totalPages: 40, status: 'currently_reading' });
    expect(result).toBe('series-ext-1');
  });

  it('does not re-patch when the total and status have not changed', async () => {
    const { service, repo, client } = makeService();
    (repo.findSeriesBookLink as any).mockResolvedValueOnce({ externalBookId: 'series-ext-1', totalPages: 40, status: 'currently_reading' });

    await service.ensureSeriesExternalBook(
      1,
      'tok',
      {
        seriesId: 5,
        seriesName: 'Comic Series',
        totalPages: 40,
        status: 'currently_reading',
        pageRanges: new Map(),
      },
      null,
    );

    expect(client.updateBooks).not.toHaveBeenCalled();
    expect(repo.upsertSeriesBookLink).not.toHaveBeenCalled();
  });

  it('never lowers the total pages when an issue leaves the series', async () => {
    const { service, repo, client } = makeService();
    (repo.findSeriesBookLink as any).mockResolvedValueOnce({ externalBookId: 'series-ext-1', totalPages: 60, status: 'currently_reading' });

    await service.ensureSeriesExternalBook(
      1,
      'tok',
      { seriesId: 5, seriesName: 'Comic Series', totalPages: 40, status: 'finished', pageRanges: new Map() },
      null,
    );

    expect(client.updateBooks).toHaveBeenCalledWith(1, 'tok', [{ id: 'series-ext-1', manual_total_pages: 60, status: 'finished' }]);
    expect(repo.upsertSeriesBookLink).toHaveBeenCalledWith(1, 5, { externalBookId: 'series-ext-1', totalPages: 60, status: 'finished' });
  });

  it('drops the stale series link and recreates the book on a 404 from the update', async () => {
    const { service, repo, client } = makeService();
    (repo.findSeriesBookLink as any)
      .mockResolvedValueOnce({ externalBookId: 'series-ext-1', totalPages: 20, status: 'currently_reading' })
      .mockResolvedValueOnce(undefined);
    (client.updateBooks as any).mockRejectedValueOnce(new ReadwiseBooksHttpError('PATCH', '/books', 404, ''));
    (client.createBooks as any).mockResolvedValueOnce([{ id: 'r1', status: 'created', book_id: 'series-ext-2' }]);

    const result = await service.ensureSeriesExternalBook(
      1,
      'tok',
      { seriesId: 5, seriesName: 'Comic Series', libraryId: 2, totalPages: 40, status: 'currently_reading', pageRanges: new Map() },
      null,
    );

    expect(repo.dropStaleSeriesBook).toHaveBeenCalledWith(1, 'series-ext-1');
    expect(client.createBooks).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ manual_total_pages: 40 })]);
    expect(result).toBe('series-ext-2');
  });

  it('drops the stale series link and recreates the book on a not_found write result from the update', async () => {
    const { service, repo, client } = makeService();
    (repo.findSeriesBookLink as any)
      .mockResolvedValueOnce({ externalBookId: 'series-ext-1', totalPages: 20, status: 'currently_reading' })
      .mockResolvedValueOnce(undefined);
    (client.updateBooks as any).mockResolvedValueOnce([{ id: 'series-ext-1', status: 'error', error: 'Book not found' }]);
    (client.createBooks as any).mockResolvedValueOnce([{ id: 'r1', status: 'created', book_id: 'series-ext-2' }]);

    const result = await service.ensureSeriesExternalBook(
      1,
      'tok',
      { seriesId: 5, seriesName: 'Comic Series', libraryId: 2, totalPages: 40, status: 'currently_reading', pageRanges: new Map() },
      null,
    );

    expect(repo.dropStaleSeriesBook).toHaveBeenCalledWith(1, 'series-ext-1');
    expect(result).toBe('series-ext-2');
  });

  it('propagates a non-404 update error without dropping the series link', async () => {
    const { service, repo, client } = makeService();
    (repo.findSeriesBookLink as any).mockResolvedValueOnce({ externalBookId: 'series-ext-1', totalPages: 20, status: 'currently_reading' });
    (client.updateBooks as any).mockRejectedValueOnce(new ReadwiseBooksHttpError('PATCH', '/books', 500, ''));

    await expect(
      service.ensureSeriesExternalBook(
        1,
        'tok',
        { seriesId: 5, seriesName: 'Comic Series', libraryId: 2, totalPages: 40, status: 'currently_reading', pageRanges: new Map() },
        null,
      ),
    ).rejects.toThrow(ReadwiseBooksHttpError);

    expect(repo.dropStaleSeriesBook).not.toHaveBeenCalled();
  });
});
