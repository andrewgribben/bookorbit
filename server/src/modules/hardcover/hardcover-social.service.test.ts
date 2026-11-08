import { ReadingServiceMatchRepository } from '../reading-services/reading-service-match.repository';
import { HardcoverSocialService } from './hardcover-social.service';
import type { HardcoverClientService } from './hardcover-client.service';
import type { ReadingServicesRepository } from '../reading-services/reading-services.repository';

function makeClient(impl: (query: string, variables?: Record<string, unknown>) => unknown) {
  return {
    query: vi
      .fn()
      .mockImplementation((_userId: number, _token: string, query: string, variables?: Record<string, unknown>) =>
        Promise.resolve(impl(query, variables)),
      ),
  } as unknown as HardcoverClientService;
}

function makeMatchRepo(result: Awaited<ReturnType<ReadingServiceMatchRepository['findCandidates']>> = []) {
  return { findCandidates: vi.fn().mockResolvedValue(result) } as unknown as ReadingServiceMatchRepository;
}

function makeReadingServicesRepo(links: { externalBookId: string }[] = []) {
  return { findBookLinksForProvider: vi.fn().mockResolvedValue(links) } as unknown as ReadingServicesRepository;
}

describe('HardcoverSocialService', () => {
  it('maps followed_user_books into friends-reading shelf items, matched by isbn13', async () => {
    const client = makeClient((query) => {
      expect(query).toContain('followed_user_books');
      return {
        followed_user_books: [
          {
            id: 1,
            status_id: 2,
            last_read_date: '2026-11-01',
            user: { id: 9, username: 'alice', name: 'Alice', image: { url: 'https://example/a.jpg' } },
            book: {
              id: 42,
              slug: 'dune',
              title: 'Dune',
              cached_contributors: [{ author: { name: 'Frank Herbert' } }],
              image: { url: 'https://example/dune.jpg' },
              editions: [{ isbn_13: '9780441013593', isbn_10: null }],
            },
          },
        ],
      };
    });
    const matchRepo = makeMatchRepo([{ externalId: '7', isbn13: '9780441013593', isbn10: null, title: 'Dune', author: 'Frank Herbert' }]);
    const service = new HardcoverSocialService(client, matchRepo, makeReadingServicesRepo());

    const items = await service.getShelf(1, 'tok', 'friends-reading');

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      provider: 'hardcover',
      externalId: '42',
      title: 'Dune',
      authors: ['Frank Herbert'],
      coverUrl: 'https://example/dune.jpg',
      externalUrl: 'https://hardcover.app/books/dune',
      bookId: 7,
      friend: { displayName: 'Alice', status: 'reading', date: '2026-11-01', avatarUrl: 'https://example/a.jpg' },
    });
  });

  it('labels friends-finished items with status finished', async () => {
    const client = makeClient((query, variables) => {
      expect(variables?.statusId).toBe(3);
      return {
        followed_user_books: [
          {
            id: 2,
            status_id: 3,
            last_read_date: '2026-10-01',
            user: { username: 'bob' },
            book: { id: 5, title: 'Cards', cached_contributors: [], editions: [] },
          },
        ],
      };
    });
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    const items = await service.getShelf(1, 'tok', 'friends-finished');

    expect(items[0]!.friend).toMatchObject({ status: 'finished', displayName: 'bob' });
    expect(items[0]!.bookId).toBeNull();
  });

  it('returns an empty list and does not throw when the friends call fails', async () => {
    const client = { query: vi.fn().mockRejectedValue(new Error('boom')) } as unknown as HardcoverClientService;
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    await expect(service.getShelf(1, 'tok', 'friends-reading')).resolves.toEqual([]);
  });

  it('treats an unexpected books_trending shape as empty instead of throwing', async () => {
    const client = makeClient(() => ({ books_trending: { unexpected: true } }));
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    await expect(service.getShelf(1, 'tok', 'trending')).resolves.toEqual([]);
  });

  it('maps a well-shaped books_trending array', async () => {
    const client = makeClient((query) => {
      expect(query).toContain('books_trending');
      return {
        books_trending: [{ id: 11, slug: 'trend', title: 'Trend Book', cached_contributors: [{ author: { name: 'T Author' } }], editions: [] }],
      };
    });
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    const items = await service.getShelf(1, 'tok', 'trending');

    expect(items).toEqual([
      expect.objectContaining({ provider: 'hardcover', externalId: '11', title: 'Trend Book', authors: ['T Author'], friend: null }),
    ]);
  });

  it('excludes books already linked to the user from the recommendations shelf', async () => {
    const client = makeClient((query) => {
      expect(query).toContain('books(order_by');
      return {
        books: [
          { id: 1, title: 'Already Have', cached_contributors: [], editions: [] },
          { id: 2, title: 'New To You', cached_contributors: [], editions: [] },
        ],
      };
    });
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo([{ externalBookId: '1' }]));

    const items = await service.getShelf(1, 'tok', 'recommendations');

    expect(items.map((i) => i.externalId)).toEqual(['2']);
  });
});
