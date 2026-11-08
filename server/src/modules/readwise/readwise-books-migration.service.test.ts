import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceRegistry } from '../reading-services/reading-service-registry.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseBooksMigrationService } from './readwise-books-migration.service';
import { ReadwiseBooksClientService } from './readwise-books-client.service';
import { ReadwiseBooksLocalBooksRepository, type LocalBookForMigration } from './readwise-books-local-books.repository';
import { ReadwiseBooksPullService } from './readwise-books-pull.service';
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
  const cacheStore = new Map<string, unknown>();
  const cache = {
    get: vi.fn((userId: number, provider: string, key: string) => Promise.resolve(cacheStore.get(`${userId}:${provider}:${key}`) ?? null)),
    set: vi.fn((userId: number, provider: string, key: string, payload: unknown) => {
      cacheStore.set(`${userId}:${provider}:${key}`, payload);
      return Promise.resolve();
    }),
  } as unknown as ReadingServiceCacheService;

  const registry = new ReadingServiceRegistry();
  const client = {
    listBooks: vi.fn(),
    createBooks: vi.fn(),
    updateBooks: vi.fn(),
  } as unknown as ReadwiseBooksClientService;
  const localBooks = { findPage: vi.fn() } as unknown as ReadwiseBooksLocalBooksRepository;
  const readwiseRepo = { upsertSettings: vi.fn(), findSettings: vi.fn() } as unknown as ReadwiseRepository;
  const readwiseSettings = { getToken: vi.fn().mockResolvedValue('tok') } as unknown as ReadwiseSettingsService;
  const readingServicesRepo = { upsertBookLink: vi.fn() } as unknown as ReadingServicesRepository;
  const pullService = { pullForUser: vi.fn() } as unknown as ReadwiseBooksPullService;

  const service = new ReadwiseBooksMigrationService(
    registry,
    client,
    localBooks,
    readwiseRepo,
    readwiseSettings,
    readingServicesRepo,
    cache,
    pullService,
  );
  return { service, client, localBooks, readwiseRepo, readwiseSettings, readingServicesRepo, registry, pullService };
}

function emptyCounters() {
  return { scanned: 0, matched: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
}

describe('ReadwiseBooksMigrationService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers itself with the reading-service registry on module init', () => {
    const { service, registry } = makeService();
    service.onModuleInit();
    expect(registry.get('readwise')).toBe(service);
  });

  describe('migratePage: index phase', () => {
    it('pages through listBooks and transitions to the push phase once next is null', async () => {
      const { service, client } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({
        results: [{ id: 'r1', product: { isbn: '9780306406157' }, status: 'finished' }],
        next: 'cursor2',
      });
      const first = await service.migratePage(1, {}, emptyCounters());
      expect(first).toEqual({ phase: 'index', next: 'cursor2' });

      (client.listBooks as any).mockResolvedValueOnce({ results: [{ id: 'r2', product: null }], next: null });
      const second = await service.migratePage(1, first!, emptyCounters());
      expect(second).toEqual({ phase: 'push', afterBookId: 0 });
    });
  });

  describe('migratePage: push phase', () => {
    it('updates a matched book and writes a link with the pushed snapshot', async () => {
      const { service, client, localBooks, readingServicesRepo } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({ results: [{ id: 'r1', product: { isbn: '9780306406157' } }], next: null });
      const indexCursor = await service.migratePage(1, {}, emptyCounters());

      (localBooks.findPage as any)
        .mockResolvedValueOnce([book({ bookId: 10, isbn13: '9780306406157', status: 'read', rating: 4 })])
        .mockResolvedValueOnce([]);
      (client.updateBooks as any).mockResolvedValueOnce([{ id: 'r1', status: 'existing' }]);

      const counters = emptyCounters();
      const next = await service.migratePage(1, indexCursor!, counters);

      expect(client.updateBooks).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ id: 'r1', status: 'finished', rating: 4 })]);
      expect(readingServicesRepo.upsertBookLink).toHaveBeenCalledWith(
        1,
        'readwise',
        10,
        expect.objectContaining({ externalBookId: 'r1', matchMethod: 'isbn13' }),
      );
      expect(counters).toMatchObject({ scanned: 1, matched: 1, updated: 1 });
      // The page (1 book) is smaller than the push page size, so this was the last page: the
      // run completes and returns null rather than another cursor.
      expect(next).toBeNull();
    });

    it('links silently without a PATCH when the remote already matches BookOrbit', async () => {
      const { service, client, localBooks, readingServicesRepo } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({
        results: [
          {
            id: 'r1',
            product: { isbn: '9780306406157' },
            status: 'finished',
            rating: 4,
            review: null,
            started_reading_at: null,
            finished_reading_at: null,
          },
        ],
        next: null,
      });
      const indexCursor = await service.migratePage(1, {}, emptyCounters());

      (localBooks.findPage as any)
        .mockResolvedValueOnce([book({ bookId: 10, isbn13: '9780306406157', status: 'read', rating: 4 })])
        .mockResolvedValueOnce([]);

      const counters = emptyCounters();
      await service.migratePage(1, indexCursor!, counters);

      expect(client.updateBooks).not.toHaveBeenCalled();
      expect(readingServicesRepo.upsertBookLink).toHaveBeenCalledWith(
        1,
        'readwise',
        10,
        expect.objectContaining({ externalBookId: 'r1', matchMethod: 'isbn13' }),
      );
      expect(counters).toMatchObject({ scanned: 1, matched: 1 });
      expect(counters.updated).toBe(0);
    });

    it('overwrites a differing remote value and still records the link', async () => {
      const { service, client, localBooks, readingServicesRepo } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({
        results: [
          {
            id: 'r1',
            product: { isbn: '9780306406157' },
            status: 'currently_reading',
            rating: 2,
            review: 'remote review',
            started_reading_at: null,
            finished_reading_at: null,
          },
        ],
        next: null,
      });
      const indexCursor = await service.migratePage(1, {}, emptyCounters());

      (localBooks.findPage as any)
        .mockResolvedValueOnce([book({ bookId: 10, isbn13: '9780306406157', status: 'read', rating: 4 })])
        .mockResolvedValueOnce([]);
      (client.updateBooks as any).mockResolvedValueOnce([{ id: 'r1', status: 'existing' }]);

      const counters = emptyCounters();
      await service.migratePage(1, indexCursor!, counters);

      expect(client.updateBooks).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ id: 'r1', status: 'finished', rating: 4 })]);
      expect(counters).toMatchObject({ scanned: 1, matched: 1, updated: 1 });
    });

    it('creates an unmatched book with status != unread and links the returned book id', async () => {
      const { service, client, localBooks, readingServicesRepo } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({ results: [], next: null });
      const indexCursor = await service.migratePage(1, {}, emptyCounters());

      (localBooks.findPage as any).mockResolvedValueOnce([book({ bookId: 20, title: 'New Book', status: 'want_to_read' })]).mockResolvedValueOnce([]);
      (client.createBooks as any).mockResolvedValueOnce([{ id: 'r9', status: 'created', book_id: 'r9' }]);

      const counters = emptyCounters();
      await service.migratePage(1, indexCursor!, counters);

      expect(client.createBooks).toHaveBeenCalledWith(1, 'tok', [expect.objectContaining({ status: 'want_to_read' })]);
      expect(readingServicesRepo.upsertBookLink).toHaveBeenCalledWith(
        1,
        'readwise',
        20,
        expect.objectContaining({ externalBookId: 'r9', matchMethod: 'created' }),
      );
      expect(counters).toMatchObject({ scanned: 1, created: 1 });
    });

    it('skips an unmatched unread book without creating or updating anything', async () => {
      const { service, client, localBooks } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({ results: [], next: null });
      const indexCursor = await service.migratePage(1, {}, emptyCounters());

      (localBooks.findPage as any).mockResolvedValueOnce([book({ bookId: 30, status: 'unread' })]).mockResolvedValueOnce([]);

      const counters = emptyCounters();
      await service.migratePage(1, indexCursor!, counters);

      expect(client.createBooks).not.toHaveBeenCalled();
      expect(client.updateBooks).not.toHaveBeenCalled();
      expect(counters).toMatchObject({ scanned: 1, skipped: 1 });
    });

    it('completes the run (returns null) and counts unmatched remote books as skipped, readwise-only', async () => {
      const { service, client, localBooks } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({
        results: [
          { id: 'owned-remote', product: { isbn: '9781111111111' }, creation_origin: 'kindle' },
          { id: 'unknown-remote', product: { isbn: '9782222222222' }, creation_origin: 'bookwise' },
        ],
        next: null,
      });
      const indexCursor = await service.migratePage(1, {}, emptyCounters());

      (localBooks.findPage as any).mockResolvedValueOnce([]);

      const counters = emptyCounters();
      const result = await service.migratePage(1, indexCursor!, counters);

      expect(result).toBeNull();
      expect(counters.skipped).toBe(2);
    });

    it('caches a readwise-only classification with title, author, cover and ownership for the migration list', async () => {
      const { service, client, localBooks } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({
        results: [
          {
            id: 'owned-remote',
            product: { isbn: '9781111111111', title: 'Piranesi', author: 'Susanna Clarke', cover_image: 'https://example.com/cover.jpg' },
            creation_origin: 'kindle',
          },
        ],
        next: null,
      });
      const indexCursor = await service.migratePage(1, {}, emptyCounters());
      (localBooks.findPage as any).mockResolvedValueOnce([]);

      await service.migratePage(1, indexCursor!, emptyCounters());

      const page = await service.listRemoteOnlyBooks(1, 0, 50);
      expect(page).toEqual({
        total: 1,
        next: null,
        items: [
          {
            externalId: 'owned-remote',
            title: 'Piranesi',
            author: 'Susanna Clarke',
            coverImageUrl: 'https://example.com/cover.jpg',
            externalUrl: null,
            ownership: 'owned',
          },
        ],
      });
    });
  });

  describe('listRemoteOnlyBooks', () => {
    it('returns an empty page when no migration has finished yet', async () => {
      const { service } = makeService();
      await expect(service.listRemoteOnlyBooks(1, 0, 50)).resolves.toEqual({ items: [], next: null, total: 0 });
    });

    it('paginates the cached classification by offset and limit', async () => {
      const { service, client, localBooks } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({
        results: [
          { id: 'rw1', product: { title: 'Book One' }, creation_origin: 'kindle' },
          { id: 'rw2', product: { title: 'Book Two' }, creation_origin: 'goodreads' },
          { id: 'rw3', product: { title: 'Book Three' }, creation_origin: null },
        ],
        next: null,
      });
      const indexCursor = await service.migratePage(1, {}, emptyCounters());
      (localBooks.findPage as any).mockResolvedValueOnce([]);
      await service.migratePage(1, indexCursor!, emptyCounters());

      const firstPage = await service.listRemoteOnlyBooks(1, 0, 2);
      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.total).toBe(3);
      expect(firstPage.next).toBe(2);

      const secondPage = await service.listRemoteOnlyBooks(1, 2, 2);
      expect(secondPage.items).toHaveLength(1);
      expect(secondPage.next).toBeNull();
    });
  });

  describe('previewMigration', () => {
    it('returns matched, toCreate and readwiseOnly counts without writing anything', async () => {
      const { service, client, localBooks, readingServicesRepo } = makeService();
      (client.listBooks as any).mockResolvedValueOnce({
        results: [
          { id: 'r1', product: { isbn: '9780306406157' } },
          { id: 'r-only', product: { isbn: '9789999999999' } },
        ],
        next: null,
      });
      (localBooks.findPage as any)
        .mockResolvedValueOnce([
          book({ bookId: 1, isbn13: '9780306406157', status: 'read' }),
          book({ bookId: 2, title: 'Fresh Book', status: 'want_to_read' }),
        ])
        .mockResolvedValueOnce([]);

      const result = await service.previewMigration(1);

      expect(result).toEqual({ matched: 1, toCreate: 1, readwiseOnly: 1 });
      expect(client.updateBooks).not.toHaveBeenCalled();
      expect(client.createBooks).not.toHaveBeenCalled();
      expect(readingServicesRepo.upsertBookLink).not.toHaveBeenCalled();
    });

    it('returns zero counts when there is no token', async () => {
      const { service, readwiseSettings } = makeService();
      (readwiseSettings.getToken as any).mockResolvedValueOnce(null);
      await expect(service.previewMigration(1)).resolves.toEqual({ matched: 0, toCreate: 0, readwiseOnly: 0 });
    });
  });

  it('delegates pull(userId) to the two-way pull service', async () => {
    const { service, pullService } = makeService();
    await service.pull(7);
    expect(pullService.pullForUser).toHaveBeenCalledWith(7);
  });

  describe('isConnected', () => {
    it('is false when settings are disabled', async () => {
      const { service, readwiseRepo } = makeService();
      (readwiseRepo.findSettings as any).mockResolvedValueOnce({ enabled: false, disabledReason: null });
      await expect(service.isConnected(1)).resolves.toBe(false);
    });

    it('is false when disabled_reason is set even if enabled', async () => {
      const { service, readwiseRepo } = makeService();
      (readwiseRepo.findSettings as any).mockResolvedValueOnce({ enabled: true, disabledReason: 'no_readwise_books' });
      await expect(service.isConnected(1)).resolves.toBe(false);
    });

    it('is true when enabled, not disabled, and a token resolves', async () => {
      const { service, readwiseRepo } = makeService();
      (readwiseRepo.findSettings as any).mockResolvedValueOnce({ enabled: true, disabledReason: null });
      await expect(service.isConnected(1)).resolves.toBe(true);
    });
  });
});
