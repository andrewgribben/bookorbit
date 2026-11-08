import { Injectable, Logger } from '@nestjs/common';

import type { ReadingServiceShelfItem } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { buildRemoteIndex, matchBook, type RemoteIndexBook } from '../reading-services/book-matcher';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { classifyReadwiseOwnership } from './readwise-book-ownership';
import type { ReadwiseBook } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseBooksLocalBooksRepository } from './readwise-books-local-books.repository';
import {
  READWISE_BOOKS_LIST_LIMIT,
  READWISE_OWNED_ELSEWHERE_CACHE_KEY,
  READWISE_OWNED_ELSEWHERE_CACHE_TTL_MS,
  READWISE_OWNED_ELSEWHERE_LOCAL_PAGE_SIZE,
} from './readwise.constants';
import { ReadwiseSettingsService } from './readwise-settings.service';
import { ReadwiseRepository } from './readwise.repository';

const PROVIDER = 'readwise' as const;
// Best-effort web link: unconfirmed against Readwise's docs (readwise-api.md has no documented
// per-book web URL). Flagged as an open question in docs/AGENT_HANDOFF.md for the next pass.
const READWISE_BOOK_WEB_URL_BASE = 'https://readwise.io/books';

/**
 * Builds the dashboard "owned-elsewhere" shelf (S7, D1): Readwise Books the ownership heuristic
 * (`readwise-book-ownership.ts`) classifies as owned, that are not already linked to a BookOrbit
 * book through `reading_service_book_links`. An item still gets `bookId` set when the pure
 * matcher independently finds a BookOrbit book by ISBN or normalized title+author, so tapping an
 * item that happens to match an unsynced library book opens that book instead of Readwise.
 *
 * Returns the same generic `ReadingServiceShelfItem` shape every other reading-service shelf
 * uses (served through `GET /reading-services/readwise/shelves/owned-elsewhere`), not a
 * Readwise-specific type, so the dashboard's generic external-shelf component can render this
 * shelf with no special-casing.
 */
@Injectable()
export class ReadwiseOwnedElsewhereService {
  private readonly logger = new Logger(ReadwiseOwnedElsewhereService.name);

  constructor(
    private readonly client: ReadwiseBooksClientService,
    private readonly readwiseSettings: ReadwiseSettingsService,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly featuresService: ReadingServiceFeaturesService,
    private readonly cache: ReadingServiceCacheService,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly localBooks: ReadwiseBooksLocalBooksRepository,
  ) {}

  async getOwnedElsewhere(userId: number): Promise<ReadingServiceShelfItem[]> {
    const settings = await this.readwiseRepo.findSettings(userId);
    if (!settings?.enabled || settings.disabledReason) return [];

    const features = await this.featuresService.getFeatures(userId, PROVIDER);
    if (features.owned === false) return [];

    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return [];

    const cached = await this.cache.get<ReadingServiceShelfItem[]>(userId, PROVIDER, READWISE_OWNED_ELSEWHERE_CACHE_KEY);
    if (cached) return cached;

    try {
      const [remoteBooks, links, localIndex] = await Promise.all([
        this.fetchAllRemoteBooks(userId, token),
        this.readingServicesRepo.findBookLinksForProvider(userId, PROVIDER),
        this.buildLocalIndex(userId),
      ]);
      const linkedExternalIds = new Set(links.map((link) => link.externalBookId));

      const items: ReadingServiceShelfItem[] = [];
      for (const book of remoteBooks) {
        if (linkedExternalIds.has(book.id)) continue; // already in the BookOrbit library via sync
        if (classifyReadwiseOwnership(book.creation_origin) !== 'owned') continue; // D: owned-only

        const title = book.product?.title ?? null;
        if (!title) continue;
        const isbn13 = book.product?.isbn ?? null;
        const author = book.product?.author ?? null;

        const match = matchBook({ isbn13, isbn10: null, title, author }, localIndex);
        items.push({
          provider: PROVIDER,
          externalId: book.id,
          title,
          authors: author ? [author] : [],
          coverUrl: null, // Readwise Books has no documented cover field; see AGENT_HANDOFF
          externalUrl: `${READWISE_BOOK_WEB_URL_BASE}/${book.id}`,
          bookId: match ? Number(match.externalId) : null,
          friend: null,
        });
      }

      await this.cache.set(userId, PROVIDER, READWISE_OWNED_ELSEWHERE_CACHE_KEY, items, READWISE_OWNED_ELSEWHERE_CACHE_TTL_MS);
      return items;
    } catch (err) {
      if (err instanceof ReadwiseBooksForbiddenError) {
        await this.readwiseRepo.upsertSettings(userId, { disabledReason: 'no_readwise_books', enabled: false });
        return [];
      }
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      this.logger.warn(
        `[readwise.owned_elsewhere] [fail] userId=${userId} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - owned-elsewhere shelf fetch failed`,
      );
      return [];
    }
  }

  private async fetchAllRemoteBooks(userId: number, token: string): Promise<ReadwiseBook[]> {
    const all: ReadwiseBook[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = await this.client.listBooks(userId, token, { limit: READWISE_BOOKS_LIST_LIMIT, cursor });
      all.push(...page.results);
      if (!page.next) break;
      cursor = page.next;
    }
    return all;
  }

  /** Builds a BookOrbit title/ISBN index keyed by bookId (as a string), for the reverse match. */
  private async buildLocalIndex(userId: number) {
    const books: RemoteIndexBook[] = [];
    let afterBookId = 0;
    for (;;) {
      const page = await this.localBooks.findPage(userId, afterBookId, READWISE_OWNED_ELSEWHERE_LOCAL_PAGE_SIZE);
      if (page.length === 0) break;
      for (const book of page) {
        books.push({ externalId: String(book.bookId), isbn13: book.isbn13, isbn10: book.isbn10, title: book.title, author: book.author });
      }
      afterBookId = page[page.length - 1]!.bookId;
      if (page.length < READWISE_OWNED_ELSEWHERE_LOCAL_PAGE_SIZE) break;
    }
    return buildRemoteIndex(books);
  }
}
