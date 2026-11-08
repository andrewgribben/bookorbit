import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import type { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import type { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseOwnedElsewhereService } from './readwise-owned-elsewhere.service';
import { ReadwiseBooksForbiddenError, type ReadwiseBooksClientService } from './readwise-books-client.service';
import type { LocalBookForMigration, ReadwiseBooksLocalBooksRepository } from './readwise-books-local-books.repository';
import type { ReadwiseSettingsService } from './readwise-settings.service';
import type { ReadwiseRepository } from './readwise.repository';

function localBook(partial: Partial<LocalBookForMigration> & { bookId: number }): LocalBookForMigration {
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
  const client = { listBooks: vi.fn() } as unknown as ReadwiseBooksClientService;
  const readwiseSettings = { getToken: vi.fn().mockResolvedValue('tok') } as unknown as ReadwiseSettingsService;
  const readwiseRepo = {
    findSettings: vi.fn().mockResolvedValue({ enabled: true, disabledReason: null }),
    upsertSettings: vi.fn(),
  } as unknown as ReadwiseRepository;
  const featuresService = { getFeatures: vi.fn().mockResolvedValue({}) } as unknown as ReadingServiceFeaturesService;
  const cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) } as unknown as ReadingServiceCacheService;
  const readingServicesRepo = { findBookLinksForProvider: vi.fn().mockResolvedValue([]) } as unknown as ReadingServicesRepository;
  const localBooks = { findPage: vi.fn().mockResolvedValue([]) } as unknown as ReadwiseBooksLocalBooksRepository;

  const service = new ReadwiseOwnedElsewhereService(client, readwiseSettings, readwiseRepo, featuresService, cache, readingServicesRepo, localBooks);
  return { service, client, readwiseSettings, readwiseRepo, featuresService, cache, readingServicesRepo, localBooks };
}

describe('ReadwiseOwnedElsewhereService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an empty list when Readwise is not enabled', async () => {
    const { service, readwiseRepo } = makeService();
    (readwiseRepo.findSettings as any).mockResolvedValue({ enabled: false, disabledReason: null });

    await expect(service.getOwnedElsewhere(1)).resolves.toEqual([]);
  });

  it('returns an empty list when the owned feature is explicitly off', async () => {
    const { service, featuresService } = makeService();
    (featuresService.getFeatures as any).mockResolvedValue({ owned: false });

    await expect(service.getOwnedElsewhere(1)).resolves.toEqual([]);
  });

  it('returns an empty list when there is no token', async () => {
    const { service, readwiseSettings } = makeService();
    (readwiseSettings.getToken as any).mockResolvedValue(null);

    await expect(service.getOwnedElsewhere(1)).resolves.toEqual([]);
  });

  it('returns the cached list without calling the Readwise client', async () => {
    const { service, cache, client } = makeService();
    const cached = [
      { provider: 'readwise', externalId: 'r1', title: 'Cached', authors: [], coverUrl: null, externalUrl: null, bookId: null, friend: null },
    ];
    (cache.get as any).mockResolvedValue(cached);

    await expect(service.getOwnedElsewhere(1)).resolves.toEqual(cached);
    expect(client.listBooks).not.toHaveBeenCalled();
  });

  it('excludes books already linked to a BookOrbit book', async () => {
    const { service, client, readingServicesRepo } = makeService();
    (client.listBooks as any).mockResolvedValue({
      results: [
        { id: 'r1', product: { isbn: '9780306406157', title: 'Piranesi', author: 'Susanna Clarke' }, creation_origin: 'kindle', status: 'finished' },
      ],
      next: null,
    });
    (readingServicesRepo.findBookLinksForProvider as any).mockResolvedValue([{ externalBookId: 'r1' }]);

    await expect(service.getOwnedElsewhere(1)).resolves.toEqual([]);
  });

  it('excludes books whose ownership is not classified as owned', async () => {
    const { service, client } = makeService();
    (client.listBooks as any).mockResolvedValue({
      results: [{ id: 'r1', product: { title: 'Goodreads import' }, creation_origin: 'goodreads', status: 'finished' }],
      next: null,
    });

    await expect(service.getOwnedElsewhere(1)).resolves.toEqual([]);
  });

  it('returns an owned, unlinked book with no library match', async () => {
    const { service, client, cache } = makeService();
    (client.listBooks as any).mockResolvedValue({
      results: [
        { id: 'r1', product: { isbn: '9780306406157', title: 'Piranesi', author: 'Susanna Clarke' }, creation_origin: 'kindle', status: 'finished' },
      ],
      next: null,
    });

    const result = await service.getOwnedElsewhere(1);

    expect(result).toEqual([
      {
        provider: 'readwise',
        externalId: 'r1',
        title: 'Piranesi',
        authors: ['Susanna Clarke'],
        coverUrl: null,
        externalUrl: 'https://readwise.io/books/r1',
        bookId: null,
        friend: null,
      },
    ]);
    expect(cache.set).toHaveBeenCalledWith(1, 'readwise', 'owned-elsewhere', result, expect.any(Number));
  });

  it('matches an owned book to a library book by ISBN', async () => {
    const { service, client, localBooks } = makeService();
    (client.listBooks as any).mockResolvedValue({
      results: [
        { id: 'r1', product: { isbn: '9780306406157', title: 'Piranesi', author: 'Susanna Clarke' }, creation_origin: 'kindle', status: 'finished' },
      ],
      next: null,
    });
    (localBooks.findPage as any)
      .mockResolvedValueOnce([localBook({ bookId: 42, isbn13: '9780306406157', title: 'Piranesi' })])
      .mockResolvedValueOnce([]);

    const result = await service.getOwnedElsewhere(1);

    expect(result[0]?.bookId).toBe(42);
  });

  it('turns a 403 into disabling the sync and returns an empty list', async () => {
    const { service, client, readwiseRepo } = makeService();
    (client.listBooks as any).mockRejectedValue(new ReadwiseBooksForbiddenError());

    await expect(service.getOwnedElsewhere(1)).resolves.toEqual([]);
    expect(readwiseRepo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'no_readwise_books', enabled: false });
  });
});
