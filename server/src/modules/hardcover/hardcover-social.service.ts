import { Injectable, Logger } from '@nestjs/common';

import type { ReadingServiceShelf, ReadingServiceShelfItem } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { buildRemoteIndex, matchBook } from '../reading-services/book-matcher';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { HardcoverClientService } from './hardcover-client.service';
import { HardcoverSocialMatchRepository } from './hardcover-social-match.repository';

const SHELF_ITEM_LIMIT = 24;
const FRIENDS_FINISHED_WINDOW_DAYS = 90;

// Hardcover `user_books.status_id`: 2 = Currently Reading, 3 = Read.
const STATUS_CURRENTLY_READING = 2;
const STATUS_READ = 3;

/**
 * UNVERIFIED query. `followed_user_books` and its argument shapes are confirmed as existing root
 * fields (research/hardcover-api.md §4, ACT/UB) but their exact `where`/`order_by` arguments are
 * inferred from the general Hasura pattern Hardcover uses elsewhere, not from introspection or a
 * live call. Verify with `__schema` against a real token before relying on this in production.
 */
const FOLLOWED_USER_BOOKS_QUERY = `
query FollowedUserBooks($statusId: Int!, $sinceDate: date, $limit: Int!) {
  followed_user_books(
    where: { status_id: { _eq: $statusId }, last_read_date: { _gte: $sinceDate } }
    order_by: { last_read_date: desc }
    limit: $limit
  ) {
    id
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
      cached_contributors { author { name } }
      image { url }
      editions(limit: 1, order_by: { users_count: desc }) {
        isbn_10
        isbn_13
      }
    }
  }
}`;

/**
 * UNVERIFIED query. `books_trending` is confirmed as a root field name only (research
 * §4: "C for the root name; I for arguments"). Its arguments and return shape are not documented
 * anywhere scraped for that research pass. This assumes a `limit` argument and a flat list of
 * book-shaped rows; `parseTrendingResponse` below treats any other shape as empty rather than
 * throwing, and a real call must confirm this before the trending/recommendations shelves are
 * considered reliable.
 */
const BOOKS_TRENDING_QUERY = `
query BooksTrending($limit: Int!) {
  books_trending(limit: $limit) {
    id
    slug
    title
    cached_contributors { author { name } }
    image { url }
    editions(limit: 1, order_by: { users_count: desc }) {
      isbn_10
      isbn_13
    }
  }
}`;

/**
 * Hardcover has no algorithmic recommendations endpoint (research §4: "NA as an algorithmic
 * feed"). This is a documented best-effort proxy: the most-added books (`users_count desc`),
 * with books already linked to the user's library filtered out below. Revisit once a real
 * recommendations field is confirmed to exist.
 */
const POPULAR_BOOKS_QUERY = `
query PopularBooks($limit: Int!) {
  books(order_by: { users_count: desc }, limit: $limit) {
    id
    slug
    title
    cached_contributors { author { name } }
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
  cached_contributors?: { author?: { name?: string | null } | null }[] | null;
  image?: { url?: string | null } | null;
  editions?: { isbn_10?: string | null; isbn_13?: string | null }[] | null;
}

interface FollowedUserBooksResult {
  followed_user_books?: {
    id: number;
    status_id: number;
    last_read_date?: string | null;
    user?: { id?: number; username?: string | null; name?: string | null; image?: { url?: string | null } | null } | null;
    book?: HardcoverSocialBook | null;
  }[];
}

interface TrendingResult {
  books_trending?: unknown;
}

interface PopularBooksResult {
  books?: HardcoverSocialBook[];
}

function bookAuthors(book: HardcoverSocialBook): string[] {
  return (book.cached_contributors ?? []).map((c) => c.author?.name).filter((name): name is string => Boolean(name));
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
    private readonly matchRepo: HardcoverSocialMatchRepository,
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
    const sinceDate = sinceDays ? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : null;

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

    const rows = (data.followed_user_books ?? []).filter((row) => row.book != null);
    const matches = await this.matchAgainstLibrary(
      userId,
      rows.map((row) => row.book!),
    );

    return rows.map((row) => {
      const book = row.book!;
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
          displayName: row.user?.name ?? row.user?.username ?? 'A Hardcover friend',
          avatarUrl: row.user?.image?.url ?? null,
          status: statusId === STATUS_READ ? 'finished' : 'reading',
          date: row.last_read_date ?? null,
        },
      };
    });
  }

  private async getTrendingShelf(userId: number, token: string): Promise<ReadingServiceShelfItem[]> {
    let data: TrendingResult;
    try {
      data = await this.client.query<TrendingResult>(userId, token, BOOKS_TRENDING_QUERY, { limit: SHELF_ITEM_LIMIT });
    } catch (err) {
      this.logFail(userId, 'trending_shelf', err);
      return [];
    }

    const books = this.parseTrendingResponse(userId, data.books_trending);
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

    const candidates = await this.matchRepo.findCandidates(userId, isbn13s, titlesLower);
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

  /** Defensive by design (research risk #1, "beta API"): an unrecognised shape yields no items. */
  private parseTrendingResponse(userId: number, raw: unknown): HardcoverSocialBook[] {
    if (!Array.isArray(raw)) {
      this.logger.warn(`[hardcover.social_trending] [fail] userId=${userId} errorClass=UnexpectedShape - books_trending did not return an array`);
      return [];
    }
    return raw.filter(
      (entry): entry is HardcoverSocialBook => typeof entry === 'object' && entry !== null && typeof (entry as { id?: unknown }).id === 'number',
    );
  }

  private logFail(userId: number, event: string, err: unknown): void {
    const error = sanitizeLogValue(err instanceof Error ? err.message : String(err));
    this.logger.warn(`[hardcover.${event}] [fail] userId=${userId} error="${error}" - shelf fetch failed`);
  }
}
