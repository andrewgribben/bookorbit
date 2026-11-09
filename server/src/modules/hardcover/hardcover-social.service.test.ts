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
    const client = makeClient((query, variables) => {
      expect(query).toContain('followed_user_books');
      expect(query).toContain('user_book {');
      expect(variables?.sinceDate).toBe('1970-01-01');
      return {
        followed_user_books: [
          {
            user_book_id: 1,
            user_book: {
              status_id: 2,
              last_read_date: '2026-11-01',
              user: { id: 9, username: 'alice', name: 'Alice', image: { url: 'https://example/a.jpg' } },
              book: {
                id: 42,
                slug: 'dune',
                title: 'Dune',
                contributions: [{ author: { name: 'Frank Herbert' } }],
                image: { url: 'https://example/dune.jpg' },
                editions: [{ isbn_13: '9780441013593', isbn_10: null }],
              },
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

  it('labels friends-finished items with status finished and a bounded since date', async () => {
    const client = makeClient((query, variables) => {
      expect(variables?.statusId).toBe(3);
      expect(variables?.sinceDate).not.toBe('1970-01-01');
      return {
        followed_user_books: [
          {
            user_book_id: 2,
            user_book: {
              status_id: 3,
              last_read_date: '2026-10-01',
              user: { username: 'bob' },
              book: { id: 5, title: 'Cards', contributions: [], editions: [] },
            },
          },
        ],
      };
    });
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    const items = await service.getShelf(1, 'tok', 'friends-finished');

    expect(items[0]!.friend).toMatchObject({ status: 'finished', displayName: 'bob' });
    expect(items[0]!.bookId).toBeNull();
  });

  it('skips followed_user_books rows with no book attached', async () => {
    const client = makeClient(() => ({
      followed_user_books: [{ user_book_id: 3, user_book: { status_id: 2, book: null } }],
    }));
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    await expect(service.getShelf(1, 'tok', 'friends-reading')).resolves.toEqual([]);
  });

  it('returns an empty list and does not throw when the friends call fails', async () => {
    const client = { query: vi.fn().mockRejectedValue(new Error('boom')) } as unknown as HardcoverClientService;
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    await expect(service.getShelf(1, 'tok', 'friends-reading')).resolves.toEqual([]);
  });

  it('returns an empty list when books_trending reports an error', async () => {
    const client = makeClient(() => ({ books_trending: { ids: null, error: 'rate limited' } }));
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    await expect(service.getShelf(1, 'tok', 'trending')).resolves.toEqual([]);
  });

  it('returns an empty list when books_trending has no ids', async () => {
    const client = makeClient(() => ({ books_trending: { ids: [], error: null } }));
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    await expect(service.getShelf(1, 'tok', 'trending')).resolves.toEqual([]);
  });

  it('looks up trending book ids and preserves ranked order', async () => {
    let call = 0;
    const client = makeClient((query, variables) => {
      call += 1;
      if (call === 1) {
        expect(query).toContain('books_trending');
        return { books_trending: { ids: [11, 22], error: null } };
      }
      expect(query).toContain('books(where: { id: { _in: $ids } })');
      expect(variables?.ids).toEqual([11, 22]);
      return {
        books: [
          { id: 22, slug: 'second', title: 'Second', contributions: [{ author: { name: 'B Author' } }], editions: [] },
          { id: 11, slug: 'first', title: 'First', contributions: [{ author: { name: 'A Author' } }], editions: [] },
        ],
      };
    });
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo());

    const items = await service.getShelf(1, 'tok', 'trending');

    expect(items.map((i) => i.externalId)).toEqual(['11', '22']);
    expect(items[0]).toMatchObject({ title: 'First', authors: ['A Author'], friend: null });
  });

  it('excludes books already linked to the user from the recommendations shelf', async () => {
    const client = makeClient((query) => {
      expect(query).toContain('books(order_by');
      return {
        books: [
          { id: 1, title: 'Already Have', contributions: [], editions: [] },
          { id: 2, title: 'New To You', contributions: [], editions: [] },
        ],
      };
    });
    const service = new HardcoverSocialService(client, makeMatchRepo(), makeReadingServicesRepo([{ externalBookId: '1' }]));

    const items = await service.getShelf(1, 'tok', 'recommendations');

    expect(items.map((i) => i.externalId)).toEqual(['2']);
  });
});
