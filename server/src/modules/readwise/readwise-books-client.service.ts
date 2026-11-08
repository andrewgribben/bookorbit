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
  cover_image?: string | null;
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

/**
 * Thrown for any non-2xx, non-401/403/429 Readwise Books response (chiefly 400s). Carries enough
 * to diagnose a bad payload from logs alone: the method and path (no query string, so no token
 * or other secret ever lands here), the status, and a sanitised, truncated response body. Never
 * carries the Authorization header or token.
 */
export class ReadwiseBooksHttpError extends Error {
  readonly status: number;
  readonly method: string;
  readonly path: string;
  readonly responseBody: string;

  constructor(method: string, path: string, status: number, responseBody: string) {
    super(`Readwise Books API error: ${method} ${path} -> ${status}${responseBody ? ` body="${responseBody}"` : ''}`);
    this.name = 'ReadwiseBooksHttpError';
    this.status = status;
    this.method = method;
    this.path = path;
    this.responseBody = responseBody;
  }
}

const RESPONSE_BODY_LOG_MAX_LENGTH = 500;

/** Strips the query string so a logged/thrown path can never carry a token or other secret. */
function pathOnly(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0]!;
  }
}

async function readSanitizedBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return sanitizeLogValue(text, RESPONSE_BODY_LOG_MAX_LENGTH);
  } catch {
    return '';
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

/** Readwise Books write endpoints answer `{ results: [...] }`, one entry per request item, in order. */
interface ReadwiseWriteResponse<T> {
  results?: T[];
  items?: T[];
}

type RawBookWriteResult = Omit<ReadwiseBookCreateResult, 'book_id' | 'id'> & { book_id?: string | number | null; id?: string | number | null };
type RawSessionWriteResult = { status?: string; session_id?: string | number | null; id?: string | number | null; error?: string | null };

/** Thrown when a write call succeeded at HTTP level but the body is not the documented shape; the write may have landed, so callers must not blindly retry. */
export class ReadwiseUnexpectedResponseError extends Error {
  constructor(operation: string) {
    super(`Readwise ${operation} returned an unexpected response shape`);
    this.name = 'ReadwiseUnexpectedResponseError';
  }
}

function readWriteResults<T>(body: ReadwiseWriteResponse<T> | null | undefined, expected: number, operation: string): T[] {
  const results = body?.results ?? body?.items;
  if (!Array.isArray(results) || results.length !== expected) throw new ReadwiseUnexpectedResponseError(operation);
  return results;
}

function normalizeBookWriteResult(r: RawBookWriteResult): ReadwiseBookCreateResult {
  return {
    ...r,
    id: r.id != null ? String(r.id) : '',
    book_id: r.book_id != null ? String(r.book_id) : undefined,
    error: r.error ?? undefined,
  };
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
    const page = await this.request<ReadwiseListBooksResult>(userId, token, 'GET', `${READWISE_BOOKS_URL}${query}`);
    // Readwise sends numeric ids; link rows and write results hold strings, so a mixed id would never match a Set or Map key.
    return { ...page, results: (page.results ?? []).map((book) => ({ ...book, id: String(book.id) })) };
  }

  async getBooksByIsbns(userId: number, token: string, isbns: string[]): Promise<ReadwiseListBooksResult> {
    return this.listBooks(userId, token, { isbns });
  }

  async createBooks(userId: number, token: string, items: ReadwiseBookCreateItem[]): Promise<ReadwiseBookCreateResult[]> {
    if (items.length === 0) return [];
    const result = await this.request<ReadwiseWriteResponse<RawBookWriteResult>>(userId, token, 'POST', READWISE_BOOKS_URL, { items });
    return readWriteResults(result, items.length, 'POST /books').map(normalizeBookWriteResult);
  }

  async updateBooks(userId: number, token: string, items: ReadwiseBookUpdateItem[]): Promise<ReadwiseBookCreateResult[]> {
    if (items.length === 0) return [];
    const result = await this.request<ReadwiseWriteResponse<RawBookWriteResult>>(userId, token, 'PATCH', READWISE_BOOKS_URL, { items });
    return readWriteResults(result, items.length, 'PATCH /books').map(normalizeBookWriteResult);
  }

  async listSessions(
    userId: number,
    token: string,
    params: ReadwiseListSessionsParams = {},
  ): Promise<{ results: ReadwiseSession[]; next: string | null }> {
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
    const result = await this.request<ReadwiseWriteResponse<RawSessionWriteResult>>(userId, token, 'POST', READWISE_SESSIONS_URL, { items });
    return readWriteResults(result, items.length, 'POST /sessions').map((r) => ({
      ...r,
      id: r.session_id != null ? String(r.session_id) : r.id != null ? String(r.id) : '',
    }));
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
    if (!res.ok) {
      const path = pathOnly(url);
      const body = await readSanitizedBody(res);
      this.logger.error(
        `[readwise.books_client] [fail] userId=${userId} method=${method} path=${path} status=${res.status} attempt=${attempt} durationMs=${Date.now() - startedAtMs} body="${body}" - Readwise Books API returned an error response`,
      );
      throw new ReadwiseBooksHttpError(method, path, res.status, body);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
}
