import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServiceLibraryScopeService } from '../reading-services/reading-service-library-scope.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseBooksLocalBooksRepository, type LocalBookForMigration } from './readwise-books-local-books.repository';
import { ReadwiseBooksPushService } from './readwise-books-push.service';
import { ReadwiseComicSeriesService } from './readwise-comic-series.service';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

function book(partial: Partial<LocalBookForMigration> & { bookId: number }): LocalBookForMigration {
  return {
    libraryId: 1,
    isbn13: null,
    isbn10: null,
    title: 'Untitled',
    author: null,
    status: 'reading',
    rating: null,
    review: null,
    startedAt: null,
    finishedAt: null,
    ...partial,
  };
}

function makeService() {
  const client = { createBooks: vi.fn(), updateBooks: vi.fn() } as unknown as ReadwiseBooksClientService;
  const localBooks = { findOne: vi.fn() } as unknown as ReadwiseBooksLocalBooksRepository;
  const readwiseRepo = { upsertSettings: vi.fn() } as unknown as ReadwiseRepository;
  const readwiseSettings = { getToken: vi.fn().mockResolvedValue('tok') } as unknown as ReadwiseSettingsService;
  const readingServicesRepo = { findBookLink: vi.fn(), upsertBookLink: vi.fn() } as unknown as ReadingServicesRepository;
  const featuresService = { getFeatures: vi.fn().mockResolvedValue({}) } as unknown as ReadingServiceFeaturesService;
  const comicSeries = { resolveRouting: vi.fn().mockResolvedValue(null) } as unknown as ReadwiseComicSeriesService;
  const libraryScopeService = {
    getEffectiveLibrarySettingsForUserId: vi.fn().mockResolvedValue(new Map()),
  } as unknown as ReadingServiceLibraryScopeService;

  const service = new ReadwiseBooksPushService(
    client,
    localBooks,
    readwiseRepo,
    readwiseSettings,
    readingServicesRepo,
    featuresService,
    comicSeries,
    libraryScopeService,
  );
  return { service, client, localBooks, readwiseRepo, readwiseSettings, readingServicesRepo, featuresService, comicSeries, libraryScopeService };
}

describe('ReadwiseBooksPushService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when there is no token', async () => {
    const { service, readwiseSettings, localBooks } = makeService();
    (readwiseSettings.getToken as any).mockResolvedValueOnce(null);
    await service.flushUser(1, [10]);
    expect(localBooks.findOne).not.toHaveBeenCalled();
  });

  it('creates a book that has no link yet and writes the link with a snapshot', async () => {
    const { service, client, localBooks, readingServicesRepo } = makeService();
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 10, status: 'want_to_read', title: 'New' }));
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce(undefined);
    (client.createBooks as any).mockResolvedValueOnce([{ id: 'r1', status: 'created', book_id: 'r1' }]);

    await service.flushUser(1, [10]);

    expect(client.createBooks).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ status: 'want_to_read' })]);
    expect(readingServicesRepo.upsertBookLink).toHaveBeenCalledWith(
      1,
      'readwise',
      10,
      expect.objectContaining({ externalBookId: 'r1', matchMethod: 'created', snapshot: expect.objectContaining({ status: 'want_to_read' }) }),
    );
  });

  it('skips an unread book with no link rather than creating it', async () => {
    const { service, client, localBooks, readingServicesRepo } = makeService();
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 11, status: 'unread' }));
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce(undefined);

    await service.flushUser(1, [11]);

    expect(client.createBooks).not.toHaveBeenCalled();
    expect(readingServicesRepo.upsertBookLink).not.toHaveBeenCalled();
  });

  it('pushes only the fields that changed from the snapshot', async () => {
    const { service, client, localBooks, readingServicesRepo } = makeService();
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 12, status: 'read', rating: 5 }));
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({
      externalBookId: 'r2',
      matchMethod: 'isbn13',
      remoteDeleted: false,
      snapshot: { status: 'reading', rating: 5, startedAt: null, finishedAt: null },
    });

    await service.flushUser(1, [12]);

    expect(client.updateBooks).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ id: 'r2', status: 'finished' })]);
    expect(readingServicesRepo.upsertBookLink).toHaveBeenCalledWith(
      1,
      'readwise',
      12,
      expect.objectContaining({ snapshot: { status: 'read', rating: 5, review: null, startedAt: null, finishedAt: null } }),
    );
  });

  it('is a no-op (echo suppression) when local already matches the snapshot', async () => {
    const { service, client, localBooks, readingServicesRepo } = makeService();
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 13, status: 'reading', rating: 4 }));
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({
      externalBookId: 'r3',
      matchMethod: 'isbn13',
      remoteDeleted: false,
      snapshot: { status: 'reading', rating: 4, startedAt: null, finishedAt: null },
    });

    await service.flushUser(1, [13]);

    expect(client.updateBooks).not.toHaveBeenCalled();
    expect(readingServicesRepo.upsertBookLink).not.toHaveBeenCalled();
  });

  it('pushes a changed review and merges it into the next snapshot', async () => {
    const { service, client, localBooks, readingServicesRepo } = makeService();
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 18, status: 'reading', rating: 4, review: 'New review text' }));
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({
      externalBookId: 'r7',
      matchMethod: 'isbn13',
      remoteDeleted: false,
      snapshot: { status: 'reading', rating: 4, review: null, startedAt: null, finishedAt: null },
    });

    await service.flushUser(1, [18]);

    expect(client.updateBooks).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ id: 'r7', review: 'New review text' })]);
    expect(readingServicesRepo.upsertBookLink).toHaveBeenCalledWith(
      1,
      'readwise',
      18,
      expect.objectContaining({ snapshot: expect.objectContaining({ review: 'New review text' }) }),
    );
  });

  it('coerces an empty-string review to null before sending to Readwise', async () => {
    const { service, client, localBooks, readingServicesRepo } = makeService();
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 19, status: 'reading', rating: 4, review: '   ' }));
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({
      externalBookId: 'r8',
      matchMethod: 'isbn13',
      remoteDeleted: false,
      snapshot: { status: 'reading', rating: 4, review: 'Old review', startedAt: null, finishedAt: null },
    });

    await service.flushUser(1, [19]);

    expect(client.updateBooks).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ id: 'r8', review: null })]);
    expect(readingServicesRepo.upsertBookLink).toHaveBeenCalledWith(
      1,
      'readwise',
      19,
      expect.objectContaining({ snapshot: expect.objectContaining({ review: '   ' }) }),
    );
  });

  it('respects a disabled rating feature toggle', async () => {
    const { service, client, localBooks, readingServicesRepo, featuresService } = makeService();
    (featuresService.getFeatures as any).mockResolvedValueOnce({ rating: false });
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 14, status: 'reading', rating: 5 }));
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({
      externalBookId: 'r4',
      matchMethod: 'isbn13',
      remoteDeleted: false,
      snapshot: { status: 'reading', rating: 1, startedAt: null, finishedAt: null },
    });

    await service.flushUser(1, [14]);

    expect(client.updateBooks).not.toHaveBeenCalled();
  });

  it('respects a library-level override that narrows a provider feature the provider toggle still allows', async () => {
    const { service, client, localBooks, readingServicesRepo, libraryScopeService } = makeService();
    (libraryScopeService.getEffectiveLibrarySettingsForUserId as any).mockResolvedValueOnce(
      new Map([[1, { enabled: true, features: { status: false }, seriesMode: false }]]),
    );
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 22, status: 'read', rating: 5, libraryId: 1 }));
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({
      externalBookId: 'r9',
      matchMethod: 'isbn13',
      remoteDeleted: false,
      snapshot: { status: 'reading', rating: 1, startedAt: null, finishedAt: null },
    });

    await service.flushUser(1, [22]);

    expect(client.updateBooks).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ id: 'r9', rating: 5 })]);
    expect(client.updateBooks).toHaveBeenCalledWith(1, 'tok', [expect.not.objectContaining({ status: expect.anything() })]);
  });

  it('does not push to a book the user removed on Readwise (remoteDeleted)', async () => {
    const { service, client, localBooks, readingServicesRepo } = makeService();
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 15, status: 'read' }));
    (readingServicesRepo.findBookLink as any).mockResolvedValueOnce({
      externalBookId: 'r5',
      matchMethod: 'isbn13',
      remoteDeleted: true,
      snapshot: { status: 'reading' },
    });

    await service.flushUser(1, [15]);

    expect(client.updateBooks).not.toHaveBeenCalled();
  });

  it('disables the connection on a 403 and stops the batch', async () => {
    const { service, client, localBooks, readingServicesRepo, readwiseRepo } = makeService();
    (localBooks.findOne as any).mockResolvedValue(book({ bookId: 16, status: 'read' }));
    (readingServicesRepo.findBookLink as any).mockResolvedValue({
      externalBookId: 'r6',
      matchMethod: 'isbn13',
      remoteDeleted: false,
      snapshot: { status: 'reading' },
    });
    (client.updateBooks as any).mockRejectedValueOnce(new ReadwiseBooksForbiddenError());

    await expect(service.flushUser(1, [16, 17])).rejects.toThrow();
    expect(readwiseRepo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'no_readwise_books', enabled: false });
  });

  it('routes a series-mode issue to the shared series book instead of creating its own', async () => {
    const { service, client, localBooks, readingServicesRepo, comicSeries } = makeService();
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 20, status: 'reading', author: 'Author A' }));
    (comicSeries.resolveRouting as any).mockResolvedValueOnce({
      seriesId: 5,
      seriesName: 'Comic Series',
      totalPages: 40,
      status: 'currently_reading',
      pageRanges: new Map([[20, { pageOffset: 0, issuePages: 20 }]]),
    });
    (comicSeries.ensureSeriesExternalBook as any) = vi.fn().mockResolvedValueOnce('series-ext-1');
    (comicSeries.linkIssueToSeries as any) = vi.fn().mockResolvedValueOnce(undefined);

    await service.flushUser(1, [20]);

    expect(comicSeries.ensureSeriesExternalBook).toHaveBeenCalledWith(1, 'tok', expect.objectContaining({ seriesId: 5 }), 'Author A', true);
    expect(comicSeries.linkIssueToSeries).toHaveBeenCalledWith(1, 20, 'series-ext-1');
    expect(client.createBooks).not.toHaveBeenCalled();
    expect(readingServicesRepo.findBookLink).not.toHaveBeenCalled();
  });

  it('still routes a series-mode issue when the status feature is off, with status omitted', async () => {
    const { service, localBooks, comicSeries, featuresService } = makeService();
    (featuresService.getFeatures as any).mockResolvedValueOnce({ status: false });
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 23, status: 'reading', author: 'Author B' }));
    (comicSeries.resolveRouting as any).mockResolvedValueOnce({
      seriesId: 7,
      seriesName: 'Another Series',
      totalPages: 40,
      status: 'currently_reading',
      pageRanges: new Map([[23, { pageOffset: 0, issuePages: 20 }]]),
    });
    (comicSeries.ensureSeriesExternalBook as any) = vi.fn().mockResolvedValueOnce('series-ext-2');
    (comicSeries.linkIssueToSeries as any) = vi.fn().mockResolvedValueOnce(undefined);

    await service.flushUser(1, [23]);

    // Routing still happens (series mode does not depend on the status feature); only the
    // status field sent to Readwise does, via the `statusOn` flag passed through.
    expect(comicSeries.resolveRouting).toHaveBeenCalledWith(1, 23, expect.any(Map));
    expect(comicSeries.ensureSeriesExternalBook).toHaveBeenCalledWith(1, 'tok', expect.objectContaining({ seriesId: 7 }), 'Author B', false);
  });

  it('skips a series-mode issue until the series has had any activity', async () => {
    const { service, client, localBooks, comicSeries } = makeService();
    (localBooks.findOne as any).mockResolvedValueOnce(book({ bookId: 21, status: 'unread' }));
    (comicSeries.resolveRouting as any).mockResolvedValueOnce({
      seriesId: 6,
      seriesName: 'Unstarted Series',
      totalPages: 20,
      status: null,
      pageRanges: new Map([[21, { pageOffset: 0, issuePages: 20 }]]),
    });
    (comicSeries.ensureSeriesExternalBook as any) = vi.fn().mockResolvedValueOnce(null);
    (comicSeries.linkIssueToSeries as any) = vi.fn();

    await service.flushUser(1, [21]);

    expect(comicSeries.linkIssueToSeries).not.toHaveBeenCalled();
    expect(client.createBooks).not.toHaveBeenCalled();
  });
});
