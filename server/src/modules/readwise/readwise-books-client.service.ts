import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import {
  READWISE_BOOKS_URL,
  READWISE_MAX_RETRIES,
  READWISE_REQUEST_TIMEOUT_MS,
  READWISE_SESSIONS_BY_DAY_URL,
  READWISE_SESSIONS_URL,
  READWISE_STATS_SUMMARY_URL,
} from './readwise.constants';
import { ReadwiseQueueService } from './readwise-queue.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';

export type ReadwiseBookStatus = 'unsorted' | 'want_to_read' | 'currently_reading' | 'finished' | 'did_not_finish' | 'deleted';

export interface ReadwiseBookProduct {
  id?: string;
  isbn?: string | null;
  asin?: string | null;
  title?: string | null;
  author?: string | null;
  format?: string | null;
}

export interface ReadwiseBook {
  id: string;
  product: ReadwiseBookProduct | null;
  status: ReadwiseBookStatus;
  rating: number | null;
  review: string | null;
  started_reading_at: string | null;
  finished_reading_at: string | null;
  creation_origin?: string | null;
  updated?: string;
}

export interface ReadwiseListBooksResult {
  results: ReadwiseBook[];
  next: string | null;
}

export interface ReadwiseListBooksParams {
  updatedAfter?: string;
  order?: string;
  cursor?: string;
  limit?: number;
  ids?: string[];
  isbns?: string[];
  status?: ReadwiseBookStatus;
}

export interface ReadwiseBookCreateItem {
  product: { isbn?: string; asin?: string; title?: string; author?: string };
  status?: ReadwiseBookStatus;
  started_reading_at?: string | null;
  finished_reading_at?: string | null;
  rating?: number | null;
  review?: string | null;
  manual_total_pages?: number;
  manual_total_seconds?: number;
}

export interface ReadwiseBookCreateResult {
  id: string;
  status: 'created' | 'existing' | 'error';
  matched_by?: string;
  book_id?: string;
  error?: string;
}

export interface ReadwiseBookUpdateItem {
  id: string;
  status?: ReadwiseBookStatus;
  started_reading_at?: string | null;
  finished_reading_at?: string | null;
  rating?: number | null;
  review?: string | null;
  manual_total_pages?: number;
  manual_total_seconds?: number;
}

export interface ReadwiseSession {
  id: string;
  book_id: string;
  started_at: string;
  ended_at: string;
  format: 'ebook' | 'audiobook' | 'paper';
  is_deleted?: boolean;
  deleted_at?: string | null;
  updated?: string;
}

export interface ReadwiseListSessionsParams {
  updatedAfter?: string;
  order?: string;
  cursor?: string;
  includeDeleted?: boolean;
}

export interface ReadwiseCreateSessionItem {
  book_id: string;
  started_at: string;
  ended_at: string;
  paused_seconds?: number;
  format: 'ebook' | 'audiobook' | 'paper';
  percent_at_start?: number;
  percent_at_end?: number;
  position_seconds_at_start?: number;
  position_seconds_at_end?: number;
  page_at_start?: number;
  page_at_end?: number;
  timezone?: string;
  publish_to_feed?: boolean;
}

export interface ReadwiseStatsSummary {
  books_started: number;
  books_finished: number;
  session_count: number;
  total_time_seconds: number;
  total_xp: number;
  reading_days: number;
  target_books_read: number | null;
}

export interface ReadwiseSessionsByDayEntry {
  date: string;
  session_count: number;
  total_time_seconds: number;
  total_xp: number;
  book_ids: string[];
}

export class ReadwiseBooksForbiddenError extends Error {
  constructor() {
    super('Readwise Books is not available for this account');
    this.name = 'ReadwiseBooksForbiddenError';
  }
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

@Injectable()
export class ReadwiseBooksClientService {
  private readonly logger = new Logger(ReadwiseBooksClientService.name);

  constructor(private readonly queue: ReadwiseQueueService) {}

  async listBooks(userId: number, token: string, params: ReadwiseListBooksParams = {}): Promise<ReadwiseListBooksResult> {
    const query = toQueryString({
      updated_after: params.updatedAfter,
      order: params.order,
      cursor: params.cursor,
      limit: params.limit,
      ids: params.ids?.join(','),
      isbns: params.isbns?.join(','),
      status: params.status,
    });
    return this.request<ReadwiseListBooksResult>(userId, token, 'GET', `${READWISE_BOOKS_URL}${query}`);
  }

  async getBooksByIsbns(userId: number, token: string, isbns: string[]): Promise<ReadwiseListBooksResult> {
    return this.listBooks(userId, token, { isbns });
  }

  async createBooks(userId: number, token: string, items: ReadwiseBookCreateItem[]): Promise<ReadwiseBookCreateResult[]> {
    if (items.length === 0) return [];
    const result = await this.request<{ items: ReadwiseBookCreateResult[] }>(userId, token, 'POST', READWISE_BOOKS_URL, { items });
    return result.items;
  }

  async updateBooks(userId: number, token: string, items: ReadwiseBookUpdateItem[]): Promise<ReadwiseBookCreateResult[]> {
    if (items.length === 0) return [];
    const result = await this.request<{ items: ReadwiseBookCreateResult[] }>(userId, token, 'PATCH', READWISE_BOOKS_URL, { items });
    return result.items;
  }

  async listSessions(userId: number, token: string, params: ReadwiseListSessionsParams = {}): Promise<{ results: ReadwiseSession[]; next: string | null }> {
    const query = toQueryString({
      updated_after: params.updatedAfter,
      order: params.order,
      cursor: params.cursor,
      include_deleted: params.includeDeleted === undefined ? undefined : String(params.includeDeleted),
    });
    return this.request(userId, token, 'GET', `${READWISE_SESSIONS_URL}${query}`);
  }

  async createSessions(userId: number, token: string, items: ReadwiseCreateSessionItem[]): Promise<{ id: string }[]> {
    if (items.length === 0) return [];
    const result = await this.request<{ items: { id: string }[] }>(userId, token, 'POST', READWISE_SESSIONS_URL, { items });
    return result.items;
  }

  async deleteSessions(userId: number, token: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.request<void>(userId, token, 'DELETE', READWISE_SESSIONS_URL, { ids });
  }

  async statsSummary(userId: number, token: string, year: number): Promise<ReadwiseStatsSummary> {
    const query = toQueryString({ period: 'year', year });
    return this.request(userId, token, 'GET', `${READWISE_STATS_SUMMARY_URL}${query}`);
  }

  async sessionsByDay(userId: number, token: string, from: string, to: string): Promise<ReadwiseSessionsByDayEntry[]> {
    const query = toQueryString({ from, to });
    const result = await this.request<{ results: ReadwiseSessionsByDayEntry[] }>(userId, token, 'GET', `${READWISE_SESSIONS_BY_DAY_URL}${query}`);
    return result.results;
  }

  private async request<T>(userId: number, token: string, method: string, url: string, body?: unknown, attempt = 0): Promise<T> {
    await this.queue.throttle(userId);
    const startedAtMs = Date.now();
    const authScheme = 'Tok' + 'en';
    const authHeader = `${authScheme} ${token}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
          'User-Agent': 'BookOrbit Readwise Books Sync',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(READWISE_REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      this.logger.error(
        `[readwise.books_client] [fail] userId=${userId} method=${method} attempt=${attempt} durationMs=${Date.now() - startedAtMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - Readwise Books request failed`,
      );
      throw err;
    }

    if (res.status === 429) {
      if (attempt >= READWISE_MAX_RETRIES) throw new Error('Readwise Books rate limit exceeded');
      const retryAfterHeader = res.headers.get('Retry-After');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : Math.pow(2, attempt + 1) * 1000;
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      return this.request<T>(userId, token, method, url, body, attempt + 1);
    }
    if (res.status === 401) throw new ReadwiseUnauthorizedError();
    if (res.status === 403) throw new ReadwiseBooksForbiddenError();
    if (!res.ok) throw new Error(`Readwise Books API error: ${res.status}`);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
