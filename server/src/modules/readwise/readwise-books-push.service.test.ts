import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseBooksLocalBooksRepository, type LocalBookForMigration } from './readwise-books-local-books.repository';
import { ReadwiseBooksPushService } from './readwise-books-push.service';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

function book(partial: Partial<LocalBookForMigration> & { bookId: number }): LocalBookForMigration {
  return {
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

  const service = new ReadwiseBooksPushService(client, localBooks, readwiseRepo, readwiseSettings, readingServicesRepo, featuresService);
  return { service, client, localBooks, readwiseRepo, readwiseSettings, readingServicesRepo, featuresService };
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
      expect.objectContaining({ snapshot: { status: 'read', rating: 5, startedAt: null, finishedAt: null } }),
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
});
