import { describe, expect, it, vi, beforeEach } from 'vitest';

import { BookService } from '../book/book.service';
import { ReadingServiceAdvisoryLockService } from '../reading-services/reading-service-advisory-lock.service';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { UserBookReviewService } from '../user-book-review/user-book-review.service';
import { UserBookStatusService } from '../user-book-status/user-book-status.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError, type ReadwiseBook } from './readwise-books-client.service';
import { ReadwiseBooksLocalBooksRepository, type LocalBookForMigration } from './readwise-books-local-books.repository';
import { ReadwiseBooksPullService } from './readwise-books-pull.service';
import { READWISE_BOOKS_PULL_CURSOR_CACHE_KEY } from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

function remoteBook(partial: Partial<ReadwiseBook> & { id: string }): ReadwiseBook {
  return {
    product: null,
    status: 'currently_reading',
    rating: null,
    review: null,
    started_reading_at: null,
    finished_reading_at: null,
    ...partial,
  };
}

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

function link(partial: Record<string, unknown> & { bookId: number; externalBookId: string }) {
  return { matchMethod: 'isbn13', remoteDeleted: false, snapshot: {}, ...partial };
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

  const client = { listBooks: vi.fn() } as unknown as ReadwiseBooksClientService;
  const readwiseRepo = { findConnectedUserIds: vi.fn(), upsertSettings: vi.fn() } as unknown as ReadwiseRepository;
  const readwiseSettings = { getToken: vi.fn().mockResolvedValue('tok') } as unknown as ReadwiseSettingsService;
  const readingServicesRepo = {
    findBookLinkByExternalId: vi.fn(),
    findBookLinksForProvider: vi.fn().mockResolvedValue([]),
    markRemoteDeleted: vi.fn(),
    upsertBookLink: vi.fn(),
  } as unknown as ReadingServicesRepository;
  const featuresService = { getFeatures: vi.fn().mockResolvedValue({}) } as unknown as ReadingServiceFeaturesService;
  const localBooks = {
    findOne: vi.fn(),
    resolveUser: vi.fn().mockResolvedValue({ id: 1, isSuperuser: false }),
  } as unknown as ReadwiseBooksLocalBooksRepository;
  const userBookStatusService = { updateManual: vi.fn() } as unknown as UserBookStatusService;
  const userBookReviewService = { setReview: vi.fn() } as unknown as UserBookReviewService;
  const bookService = { bulkSetRating: vi.fn() } as unknown as BookService;
  const lock = {
    runExclusive: vi.fn((_op: string, _userId: number, fn: () => Promise<unknown>) => fn()),
  } as unknown as ReadingServiceAdvisoryLockService;

  const service = new ReadwiseBooksPullService(
    client,
    readwiseRepo,
    readwiseSettings,
    readingServicesRepo,
    featuresService,
    cache,
    localBooks,
    userBookStatusService,
    userBookReviewService,
    bookService,
    lock,
  );
  return {
    service,
    cache,
    client,
    readwiseRepo,
    readwiseSettings,
    readingServicesRepo,
    featuresService,
    localBooks,
    userBookStatusService,
    userBookReviewService,
    bookService,
    lock,
  };
}

describe('ReadwiseBooksPullService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when there is no token', async () => {
    const { service, readwiseSettings, client } = makeService();
    (readwiseSettings.getToken as any).mockResolvedValueOnce(null);
    await service.pullForUser(1);
    expect(client.listBooks).not.toHaveBeenCalled();
  });

  it('skips the pull when the advisory lock is already held, leaving the cursor untouched', async () => {
    const { service, client, cache, lock } = makeService();
    (lock.runExclusive as any).mockResolvedValueOnce(null);
    await service.pullForUser(1);
    expect(client.listBooks).not.toHaveBeenCalled();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('a second concurrent pull for the same user is skipped while the first holds the lock', async () => {
    const { service, client, lock } = makeService();
    client.listBooks = vi.fn().mockResolvedValue({ results: [], next: null }) as any;
    let releaseFirst: (() => void) | undefined;
    const firstHeld = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    (lock.runExclusive as any)
      .mockImplementationOnce(async (_op: string, _userId: number, fn: () => Promise<unknown>) => {
        const result = fn();
        releaseFirst?.();
        return result;
      })
      .mockImplementationOnce(async () => {
        await firstHeld;
        return null;
      });

    const [first, second] = await Promise.all([service.pullForUser(1), service.pullForUser(1)]);
    expect(first).toBeUndefined();
    expect(second).toBeUndefined();
    expect(lock.runExclusive).toHaveBeenCalledTimes(2);
  });

  describe('status mapping rows (section 4.1)', () => {
    it.each([
      ['want_to_read', 'want_to_read'],
      ['currently_reading', 'reading'],
      ['finished', 'read'],
      ['did_not_finish', 'abandoned'],
    ] as const)('remote %s pulls to %s for a local book with no status yet', async (remoteStatus, expected) => {
      const { service, client, readingServicesRepo, localBooks, userBookStatusService } = makeService();
      client.listBooks = vi.fn().mockResolvedValueOnce({ results: [remoteBook({ id: 'r1', status: remoteStatus })], next: null }) as any;
      (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(
        link({ bookId: 10, externalBookId: 'r1', snapshot: { status: 'unread' } }),
      );
      (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'unread' }));

      await service.pullForUser(1);

      expect(userBookStatusService.updateManual).toHaveBeenCalledWith(1, 10, expect.objectContaining({ status: expected }));
    });

    it.each(['rereading', 'on_hold'] as const)(
      'keeps a local %s status under a remote currently_reading (no spurious update)',
      async (currentLocal) => {
        const { service, client, readingServicesRepo, localBooks, userBookStatusService } = makeService();
        client.listBooks = vi.fn().mockResolvedValueOnce({ results: [remoteBook({ id: 'r1', status: 'currently_reading' })], next: null }) as any;
        (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(link({ bookId: 10, externalBookId: 'r1' }));
        (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: currentLocal }));

        await service.pullForUser(1);

        expect(userBookStatusService.updateManual).not.toHaveBeenCalled();
      },
    );

    it('keeps a local skimmed status under a remote finished (no spurious update)', async () => {
      const { service, client, readingServicesRepo, localBooks, userBookStatusService } = makeService();
      client.listBooks = vi.fn().mockResolvedValueOnce({ results: [remoteBook({ id: 'r1', status: 'finished' })], next: null }) as any;
      (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(link({ bookId: 10, externalBookId: 'r1' }));
      (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'skimmed' }));

      await service.pullForUser(1);

      expect(userBookStatusService.updateManual).not.toHaveBeenCalled();
    });

    it.each(['unsorted', 'deleted'] as const)('makes no local change for remote %s (other than marking remote_deleted)', async (remoteStatus) => {
      const { service, client, readingServicesRepo, localBooks, userBookStatusService } = makeService();
      client.listBooks = vi.fn().mockResolvedValueOnce({ results: [remoteBook({ id: 'r1', status: remoteStatus })], next: null }) as any;
      (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(link({ bookId: 10, externalBookId: 'r1' }));
      (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'reading' }));

      await service.pullForUser(1);

      expect(userBookStatusService.updateManual).not.toHaveBeenCalled();
      if (remoteStatus === 'deleted') {
        expect(readingServicesRepo.markRemoteDeleted).toHaveBeenCalledWith(1, 'readwise', 10);
      }
    });
  });

  it('rounds a Readwise rating to the nearest integer, half rounding up', async () => {
    const { service, client, readingServicesRepo, localBooks, bookService } = makeService();
    client.listBooks = vi
      .fn()
      .mockResolvedValueOnce({ results: [remoteBook({ id: 'r1', status: 'reading' as any, rating: 3.5 })], next: null }) as any;
    (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(link({ bookId: 10, externalBookId: 'r1', snapshot: { rating: 3 } }));
    (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'reading', rating: 3 }));

    await service.pullForUser(1);

    expect(bookService.bulkSetRating).toHaveBeenCalledWith([10], 4, expect.objectContaining({ id: 1 }));
  });

  it('pulls a date when the local value is null', async () => {
    const { service, client, readingServicesRepo, localBooks, userBookStatusService } = makeService();
    client.listBooks = vi.fn().mockResolvedValueOnce({
      results: [remoteBook({ id: 'r1', status: 'reading' as any, started_reading_at: '2026-01-01T00:00:00Z' })],
      next: null,
    }) as any;
    (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(link({ bookId: 10, externalBookId: 'r1' }));
    (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'reading', startedAt: null }));

    await service.pullForUser(1);

    expect(userBookStatusService.updateManual).toHaveBeenCalledWith(1, 10, expect.objectContaining({ startedAt: new Date('2026-01-01T00:00:00Z') }));
  });

  it('echo suppression: skips a book that already matches the snapshot on every field', async () => {
    const { service, client, readingServicesRepo, localBooks, userBookStatusService, bookService } = makeService();
    client.listBooks = vi
      .fn()
      .mockResolvedValueOnce({ results: [remoteBook({ id: 'r1', status: 'currently_reading', rating: 4 })], next: null }) as any;
    (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(
      link({ bookId: 10, externalBookId: 'r1', snapshot: { status: 'reading', rating: 4, startedAt: null, finishedAt: null } }),
    );
    (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'reading', rating: 4 }));

    await service.pullForUser(1);

    expect(userBookStatusService.updateManual).not.toHaveBeenCalled();
    expect(bookService.bulkSetRating).not.toHaveBeenCalled();
    expect(readingServicesRepo.upsertBookLink).not.toHaveBeenCalled();
  });

  it('conflict: BookOrbit wins when both sides changed rating since the snapshot', async () => {
    const { service, client, readingServicesRepo, localBooks, bookService } = makeService();
    // snapshot=2, local changed to 5, remote changed to 1: both differ from the snapshot.
    client.listBooks = vi.fn().mockResolvedValueOnce({ results: [remoteBook({ id: 'r1', status: 'reading' as any, rating: 1 })], next: null }) as any;
    (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(link({ bookId: 10, externalBookId: 'r1', snapshot: { rating: 2 } }));
    (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'reading', rating: 5 }));

    await service.pullForUser(1);

    expect(bookService.bulkSetRating).not.toHaveBeenCalled();
  });

  it('runs a full pass and marks a link remote_deleted when the book no longer appears anywhere', async () => {
    const { service, client, readingServicesRepo } = makeService();
    client.listBooks = vi.fn().mockResolvedValueOnce({ results: [], next: null }) as any;
    (readingServicesRepo.findBookLinksForProvider as any).mockResolvedValueOnce([link({ bookId: 10, externalBookId: 'r-gone' })]);

    await service.pullForUser(1);

    expect(readingServicesRepo.markRemoteDeleted).toHaveBeenCalledWith(1, 'readwise', 10);
  });

  it('pulls a review when the local value is null', async () => {
    const { service, client, readingServicesRepo, localBooks, userBookReviewService } = makeService();
    client.listBooks = vi.fn().mockResolvedValueOnce({
      results: [remoteBook({ id: 'r1', status: 'reading' as any, review: 'Loved it.' })],
      next: null,
    }) as any;
    (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(
      link({ bookId: 10, externalBookId: 'r1', snapshot: { review: null } }),
    );
    (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'reading', review: null }));

    await service.pullForUser(1);

    expect(userBookReviewService.setReview).toHaveBeenCalledWith(1, 10, 'Loved it.');
  });

  it('does not pull an empty-string remote review (treated as no change, not written as empty)', async () => {
    const { service, client, readingServicesRepo, localBooks, userBookReviewService } = makeService();
    client.listBooks = vi.fn().mockResolvedValueOnce({
      results: [remoteBook({ id: 'r1', status: 'reading' as any, review: '   ' })],
      next: null,
    }) as any;
    (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(
      link({ bookId: 10, externalBookId: 'r1', snapshot: { review: null } }),
    );
    (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'reading', review: null }));

    await service.pullForUser(1);

    expect(userBookReviewService.setReview).not.toHaveBeenCalled();
  });

  it('review conflict: BookOrbit wins when both sides changed review since the snapshot', async () => {
    const { service, client, readingServicesRepo, localBooks, userBookReviewService } = makeService();
    client.listBooks = vi
      .fn()
      .mockResolvedValueOnce({ results: [remoteBook({ id: 'r1', status: 'reading' as any, review: 'Remote text' })], next: null }) as any;
    (readingServicesRepo.findBookLinkByExternalId as any).mockResolvedValueOnce(
      link({ bookId: 10, externalBookId: 'r1', snapshot: { review: 'Original' } }),
    );
    (localBooks.findOne as any).mockResolvedValueOnce(localBook({ bookId: 10, status: 'reading', review: 'Local text' }));

    await service.pullForUser(1);

    expect(userBookReviewService.setReview).not.toHaveBeenCalled();
  });

  it('runs an incremental pass (not a full pass) when the 6-hour window has not elapsed', async () => {
    const { service, cache, client } = makeService();
    const nowIso = new Date().toISOString();
    (cache.get as any).mockResolvedValueOnce({ updatedAfter: nowIso, lastFullPassAt: nowIso });
    client.listBooks = vi.fn().mockResolvedValueOnce({ results: [], next: null }) as any;

    await service.pullForUser(1);

    expect(client.listBooks).toHaveBeenCalledWith(1, 'tok', expect.objectContaining({ order: 'updated', updatedAfter: nowIso }));
  });

  it('runs a full pass when the 6-hour window has elapsed', async () => {
    const { service, cache, client } = makeService();
    const stale = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
    (cache.get as any).mockResolvedValueOnce({ updatedAfter: stale, lastFullPassAt: stale });
    client.listBooks = vi.fn().mockResolvedValueOnce({ results: [], next: null }) as any;

    await service.pullForUser(1);

    const call = (client.listBooks as any).mock.calls[0][2];
    expect(call.order).toBeUndefined();
    expect(cache.set).toHaveBeenCalledWith(
      1,
      'readwise',
      READWISE_BOOKS_PULL_CURSOR_CACHE_KEY,
      expect.objectContaining({ lastFullPassAt: expect.any(String) }),
      expect.any(Number),
    );
  });

  it('disables the connection on a 403', async () => {
    const { service, client, readwiseRepo } = makeService();
    client.listBooks = vi.fn().mockRejectedValueOnce(new ReadwiseBooksForbiddenError()) as any;

    await service.pullForUser(1);

    expect(readwiseRepo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'no_readwise_books', enabled: false });
  });

  describe('pullAllConnectedUsers', () => {
    it('processes connected users in batches of 2', async () => {
      const { service, readwiseRepo, client } = makeService();
      (readwiseRepo.findConnectedUserIds as any).mockResolvedValueOnce([1, 2, 3]);
      client.listBooks = vi.fn().mockResolvedValue({ results: [], next: null }) as any;

      await service.pullAllConnectedUsers();

      expect(client.listBooks).toHaveBeenCalledTimes(3);
    });
  });
});
