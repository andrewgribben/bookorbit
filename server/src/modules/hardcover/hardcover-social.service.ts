import { Injectable, Logger } from '@nestjs/common';

import type { ReadingServiceShelf, ReadingServiceShelfItem } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { buildRemoteIndex, matchBook } from '../reading-services/book-matcher';
import { ReadingServiceMatchRepository } from '../reading-services/reading-service-match.repository';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { HardcoverClientService } from './hardcover-client.service';

const SHELF_ITEM_LIMIT = 24;
const FRIENDS_FINISHED_WINDOW_DAYS = 90;

// Hardcover `user_books.status_id`: 2 = Currently Reading, 3 = Read.
const STATUS_CURRENTLY_READING = 2;
const STATUS_READ = 3;

// Sentinel used in place of a real "since" date when no time window applies, so a single
// query shape can always include the `last_read_date` filter (Hasura null comparisons are
// unreliable, so we avoid `{ _gte: null }` entirely).
const EPOCH_DATE = '1970-01-01';

/**
 * Verified against docs.hardcover.app/api/graphql/schemas/userbooks and the published
 * schema.graphql (github.com/hardcoverapp/hardcover-docs). `followed_user_books` itself only
 * exposes `book`, `book_id`, `follower_user`, `follower_user_id`, `user`, `user_book`,
 * `user_book_id` and `user_id`; reading status (`status_id`) and completion date
 * (`last_read_date`) live on the related `user_books` row, reached via the `user_book`
 * relation, and must be filtered/ordered through `where: { user_book: { ... } }` rather than
 * as top-level fields (the live bug: `last_read_date` does not exist directly on
 * `followed_user_books_bool_exp`).
 */
const FOLLOWED_USER_BOOKS_QUERY = `
query FollowedUserBooks($statusId: Int!, $sinceDate: date!, $limit: Int!) {
  followed_user_books(
    where: { user_book: { status_id: { _eq: $statusId }, last_read_date: { _gte: $sinceDate } } }
    order_by: { user_book: { last_read_date: desc } }
    limit: $limit
  ) {
    user_book_id
    user_book {
      status_id
      last_read_date
      user {
        id
        username
        name
        image { url }
      }
      book {
        id
        slug
        title
        contributions { author { name } }
        image { url }
        editions(limit: 1, order_by: { users_count: desc }) {
          isbn_10
          isbn_13
        }
      }
    }
  }
}`;

/**
 * Verified against docs.hardcover.app/api/graphql/schemas/books. `books_trending` returns a
 * `TrendingBookType` (`{ error, ids }`) of ranked book ids only, not book rows, so the fields
 * selected here must stay scalar (the live bug: selecting `id` as a sub-field failed because
 * `TrendingBookType` has no `id` field). Book details are fetched separately below.
 */
const BOOKS_TRENDING_QUERY = `
query BooksTrending($limit: Int!) {
  books_trending(duration: month, limit: $limit) {
    ids
    error
  }
}`;

/**
 * Verified against docs.hardcover.app/api/graphql/schemas/books: `id` accepts the standard
 * Hasura `Int_comparison_exp`, so `_in` is a supported filter for a batched lookup.
 */
const BOOKS_BY_IDS_QUERY = `
query BooksByIds($ids: [Int!]!) {
  books(where: { id: { _in: $ids } }) {
    id
    slug
    title
    contributions { author { name } }
    image { url }
    editions(limit: 1, order_by: { users_count: desc }) {
      isbn_10
      isbn_13
    }
  }
}`;

/**
 * Hardcover has no algorithmic recommendations endpoint as of this writing. This remains a
 * documented best-effort proxy: the most-shelved books (`users_count desc`), with books already
 * linked to the user's library filtered out below. Revisit if a real recommendations field is
 * ever added.
 */
const POPULAR_BOOKS_QUERY = `
query PopularBooks($limit: Int!) {
  books(order_by: { users_count: desc }, limit: $limit) {
    id
    slug
    title
    contributions { author { name } }
    image { url }
    editions(limit: 1, order_by: { users_count: desc }) {
      isbn_10
      isbn_13
    }
  }
}`;

interface HardcoverSocialBook {
  id: number;
  slug?: string | null;
  title?: string | null;
  contributions?: { author?: { name?: string | null } | null }[] | null;
  image?: { url?: string | null } | null;
  editions?: { isbn_10?: string | null; isbn_13?: string | null }[] | null;
}

interface FollowedUserBooksResult {
  followed_user_books?: {
    user_book_id?: number | null;
    user_book?: {
      status_id: number;
      last_read_date?: string | null;
      user?: { id?: number; username?: string | null; name?: string | null; image?: { url?: string | null } | null } | null;
      book?: HardcoverSocialBook | null;
    } | null;
  }[];
}

interface TrendingResult {
  books_trending?: { ids?: (number | null)[] | null; error?: string | null } | null;
}

interface BooksByIdsResult {
  books?: HardcoverSocialBook[];
}

interface PopularBooksResult {
  books?: HardcoverSocialBook[];
}

function bookAuthors(book: HardcoverSocialBook): string[] {
  return (book.contributions ?? []).map((c) => c.author?.name).filter((name): name is string => Boolean(name));
}

function bookIsbns(book: HardcoverSocialBook): { isbn13: string | null; isbn10: string | null } {
  const edition = book.editions?.[0];
  return { isbn13: edition?.isbn_13 ?? null, isbn10: edition?.isbn_10 ?? null };
}

function hardcoverBookUrl(book: HardcoverSocialBook): string | null {
  return book.slug ? `https://hardcover.app/books/${book.slug}` : null;
}

@Injectable()
export class HardcoverSocialService {
  private readonly logger = new Logger(HardcoverSocialService.name);

  constructor(
    private readonly client: HardcoverClientService,
    private readonly matchRepo: ReadingServiceMatchRepository,
    private readonly readingServicesRepo: ReadingServicesRepository,
  ) {}

  async getShelf(userId: number, token: string, shelf: ReadingServiceShelf): Promise<ReadingServiceShelfItem[]> {
    switch (shelf) {
      case 'friends-reading':
        return this.getFriendsShelf(userId, token, STATUS_CURRENTLY_READING, null);
      case 'friends-finished':
        return this.getFriendsShelf(userId, token, STATUS_READ, FRIENDS_FINISHED_WINDOW_DAYS);
      case 'trending':
        return this.getTrendingShelf(userId, token);
      case 'recommendations':
        return this.getRecommendationsShelf(userId, token);
      default:
        return [];
    }
  }

  private async getFriendsShelf(userId: number, token: string, statusId: number, sinceDays: number | null): Promise<ReadingServiceShelfItem[]> {
    const sinceDate = sinceDays ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : EPOCH_DATE;

    let data: FollowedUserBooksResult;
    try {
      data = await this.client.query<FollowedUserBooksResult>(userId, token, FOLLOWED_USER_BOOKS_QUERY, {
        statusId,
        sinceDate,
        limit: SHELF_ITEM_LIMIT,
      });
    } catch (err) {
      this.logFail(userId, 'friends_shelf', err);
      return [];
    }

    const userBooks = (data.followed_user_books ?? [])
      .map((row) => row.user_book)
      .filter((userBook): userBook is NonNullable<typeof userBook> => userBook?.book != null);

    const matches = await this.matchAgainstLibrary(
      userId,
      userBooks.map((userBook) => userBook.book!),
    );

    return userBooks.map((userBook) => {
      const book = userBook.book!;
      const { isbn13 } = bookIsbns(book);
      return {
        provider: 'hardcover' as const,
        externalId: String(book.id),
        title: book.title ?? 'Untitled',
        authors: bookAuthors(book),
        coverUrl: book.image?.url ?? null,
        externalUrl: hardcoverBookUrl(book),
        bookId: matches.get(String(book.id)) ?? matches.get(isbn13 ?? '') ?? null,
        friend: {
          displayName: userBook.user?.name ?? userBook.user?.username ?? 'A Hardcover friend',
          avatarUrl: userBook.user?.image?.url ?? null,
          status: statusId === STATUS_READ ? 'finished' : 'reading',
          date: userBook.last_read_date ?? null,
        },
      };
    });
  }

  private async getTrendingShelf(userId: number, token: string): Promise<ReadingServiceShelfItem[]> {
    let trending: TrendingResult;
    try {
      trending = await this.client.query<TrendingResult>(userId, token, BOOKS_TRENDING_QUERY, { limit: SHELF_ITEM_LIMIT });
    } catch (err) {
      this.logFail(userId, 'trending_shelf', err);
      return [];
    }

    if (trending.books_trending?.error) {
      this.logger.warn(
        `[hardcover.trending_shelf] [fail] userId=${userId} error="${sanitizeLogValue(trending.books_trending.error)}" - books_trending returned an error`,
      );
      return [];
    }

    const ids = (trending.books_trending?.ids ?? []).filter((id): id is number => typeof id === 'number');
    if (ids.length === 0) return [];

    let data: BooksByIdsResult;
    try {
      data = await this.client.query<BooksByIdsResult>(userId, token, BOOKS_BY_IDS_QUERY, { ids });
    } catch (err) {
      this.logFail(userId, 'trending_shelf_lookup', err);
      return [];
    }

    const byId = new Map((data.books ?? []).map((book) => [book.id, book]));
    const books = ids.map((id) => byId.get(id)).filter((book): book is HardcoverSocialBook => book != null);

    return this.toShelfItems(userId, books, null);
  }

  private async getRecommendationsShelf(userId: number, token: string): Promise<ReadingServiceShelfItem[]> {
    let data: PopularBooksResult;
    try {
      data = await this.client.query<PopularBooksResult>(userId, token, POPULAR_BOOKS_QUERY, { limit: SHELF_ITEM_LIMIT * 2 });
    } catch (err) {
      this.logFail(userId, 'recommendations_shelf', err);
      return [];
    }

    const links = await this.readingServicesRepo.findBookLinksForProvider(userId, 'hardcover');
    const alreadyTracked = new Set(links.map((link) => link.externalBookId));
    const books = (data.books ?? []).filter((book) => !alreadyTracked.has(String(book.id))).slice(0, SHELF_ITEM_LIMIT);

    return this.toShelfItems(userId, books, null);
  }

  private async toShelfItems(
    userId: number,
    books: HardcoverSocialBook[],
    friend: ReadingServiceShelfItem['friend'],
  ): Promise<ReadingServiceShelfItem[]> {
    const matches = await this.matchAgainstLibrary(userId, books);
    return books.map((book) => {
      const { isbn13 } = bookIsbns(book);
      return {
        provider: 'hardcover' as const,
        externalId: String(book.id),
        title: book.title ?? 'Untitled',
        authors: bookAuthors(book),
        coverUrl: book.image?.url ?? null,
        externalUrl: hardcoverBookUrl(book),
        bookId: matches.get(String(book.id)) ?? matches.get(isbn13 ?? '') ?? null,
        friend,
      };
    });
  }

  /** Returns a map keyed by both the external book id and its isbn13, to whichever is matched. */
  private async matchAgainstLibrary(userId: number, books: HardcoverSocialBook[]): Promise<Map<string, number>> {
    const isbn13s = books.map((book) => bookIsbns(book).isbn13).filter((isbn): isbn is string => Boolean(isbn));
    const titlesLower = books.map((book) => book.title?.toLowerCase()).filter((title): title is string => Boolean(title));

    const candidates = await this.matchRepo.findCandidates(userId, 'hardcover', isbn13s, titlesLower);
    if (candidates.length === 0) return new Map();

    const index = buildRemoteIndex(candidates);
    const result = new Map<string, number>();

    for (const book of books) {
      const { isbn13, isbn10 } = bookIsbns(book);
      const match = matchBook({ isbn13, isbn10, title: book.title ?? '', author: bookAuthors(book)[0] ?? null }, index);
      if (!match) continue;
      const bookId = Number(match.externalId);
      result.set(String(book.id), bookId);
      if (isbn13) result.set(isbn13, bookId);
    }

    return result;
  }

  private logFail(userId: number, event: string, err: unknown): void {
    const error = sanitizeLogValue(err instanceof Error ? err.message : String(err));
    this.logger.warn(`[hardcover.${event}] [fail] userId=${userId} error="${error}" - shelf fetch failed`);
  }
}
