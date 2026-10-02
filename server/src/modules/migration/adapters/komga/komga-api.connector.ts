import { BadRequestException, Injectable } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http';
import { request as httpsRequest } from 'node:https';

import { ensureSafeRemoteHost } from '../../../../common/utils/ssrf.utils';
import type { KomgaConnectionConfig } from './komga-connection-config';
import type {
  KomgaBookRecord,
  KomgaCollectionRecord,
  KomgaLibraryRecord,
  KomgaReadListRecord,
  KomgaSeriesRecord,
  KomgaSourceRecords,
  KomgaUserRecord,
} from './komga-source.types';

type RequestMethod = 'GET';
type AddressFamily = 4 | 6;

interface KomgaStatus {
  sourceVersion: string | null;
}

interface PageEnvelope<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  last: boolean;
}

export interface KomgaApiSnapshotSummary {
  sourceVersion: string | null;
  warnings: string[];
  counts: Record<string, number>;
}

export interface JsonRequestOptions {
  method?: RequestMethod;
  maxResponseBytes?: number;
  retryable?: boolean;
  timeoutMs?: number;
}

export interface PinnedAddress {
  address: string;
  family: AddressFamily;
}

export type AddressResolver = (hostname: string, options: { all: true; verbatim: true }) => Promise<Array<{ address: string; family: number }>>;
type RequestFactory = (url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => ClientRequest;

const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const PAGE_MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const PAGE_SIZE = 200;
const MAX_PAGE_COUNT = 100_000;
const MAX_REQUEST_ATTEMPTS = 2;
const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

@Injectable()
export class KomgaApiConnector {
  async getStatus(config: KomgaConnectionConfig): Promise<KomgaStatus> {
    try {
      const payload = asRecord(await this.requestJson(config, '/actuator/info'));
      const build = asRecord(payload.build);
      return { sourceVersion: nullableString(build.version) ?? nullableString(payload.version) };
    } catch (error) {
      if (error instanceof BadRequestException) {
        const message = String(error.message);
        if (message.includes('status 404') || message.includes('status 401') || message.includes('status 403')) {
          return { sourceVersion: null };
        }
      }
      // Version discovery is best-effort; authentication is verified separately.
      return { sourceVersion: null };
    }
  }

  async getCurrentUser(config: KomgaConnectionConfig): Promise<KomgaUserRecord> {
    const payload = asRecord(await this.requestJson(config, '/api/v2/users/me'));
    const user = mapUser(payload);
    if (!user) throw new BadRequestException('Komga authentication returned an invalid user');
    return user;
  }

  async getUsers(config: KomgaConnectionConfig): Promise<KomgaUserRecord[] | null> {
    try {
      const payload = await this.requestJson(config, '/api/v2/users');
      return asArray(payload)
        .map(mapUser)
        .filter((user): user is KomgaUserRecord => user !== null);
    } catch (error) {
      if (error instanceof BadRequestException) {
        const message = String(error.message);
        if (message.includes('status 401') || message.includes('status 403') || message.includes('authentication or authorization')) {
          return null;
        }
      }
      throw error;
    }
  }

  async getLibraries(config: KomgaConnectionConfig): Promise<KomgaLibraryRecord[]> {
    const payload = await this.requestJson(config, '/api/v1/libraries');
    return asArray(payload).map(mapLibrary).filter(isPresent);
  }

  async getBooksPage(config: KomgaConnectionConfig, page: number): Promise<PageEnvelope<KomgaBookRecord>> {
    const path = `/api/v1/books?page=${page}&size=${PAGE_SIZE}&deleted=false`;
    return mapPage(await this.requestJson(config, path, { maxResponseBytes: PAGE_MAX_RESPONSE_BYTES }), mapBook);
  }

  async getSeriesPage(config: KomgaConnectionConfig, page: number): Promise<PageEnvelope<KomgaSeriesRecord>> {
    const path = `/api/v1/series?page=${page}&size=${PAGE_SIZE}&deleted=false`;
    return mapPage(await this.requestJson(config, path, { maxResponseBytes: PAGE_MAX_RESPONSE_BYTES }), mapSeries);
  }

  async getCollectionsPage(config: KomgaConnectionConfig, page: number): Promise<PageEnvelope<KomgaCollectionRecord>> {
    const path = `/api/v1/collections?page=${page}&size=${PAGE_SIZE}`;
    return mapPage(await this.requestJson(config, path, { maxResponseBytes: PAGE_MAX_RESPONSE_BYTES }), mapCollection);
  }

  async getReadListsPage(config: KomgaConnectionConfig, page: number): Promise<PageEnvelope<KomgaReadListRecord>> {
    const path = `/api/v1/readlists?page=${page}&size=${PAGE_SIZE}`;
    return mapPage(await this.requestJson(config, path, { maxResponseBytes: PAGE_MAX_RESPONSE_BYTES }), mapReadList);
  }

  async fetchSourceRecords(config: KomgaConnectionConfig): Promise<KomgaSourceRecords> {
    // Komga only returns readProgress for the authenticated principal. Import that
    // single user rather than listing other accounts without progress.
    const [status, currentUser] = await Promise.all([this.getStatus(config), this.getCurrentUser(config)]);

    const [libraries, series, books, collections, readLists] = await Promise.all([
      this.getLibraries(config),
      this.getAllPages((page) => this.getSeriesPage(config, page), 'series'),
      this.getAllPages((page) => this.getBooksPage(config, page), 'books'),
      this.getAllPages((page) => this.getCollectionsPage(config, page), 'collections'),
      this.getAllPages((page) => this.getReadListsPage(config, page), 'read lists'),
    ]);

    return {
      sourceVersion: status.sourceVersion,
      authenticatedUserId: currentUser.id,
      users: [currentUser],
      libraries,
      series,
      books,
      collections,
      readLists,
      warnings: [],
    };
  }

  async fetchSnapshotSummary(config: KomgaConnectionConfig): Promise<KomgaApiSnapshotSummary> {
    const [status] = await Promise.all([this.getStatus(config), this.getCurrentUser(config)]);
    const [libraries, firstBooks, firstSeries, firstCollections, firstReadLists] = await Promise.all([
      this.getLibraries(config),
      this.getBooksPage(config, 0),
      this.getSeriesPage(config, 0),
      this.getCollectionsPage(config, 0),
      this.getReadListsPage(config, 0),
    ]);

    return {
      sourceVersion: status.sourceVersion,
      warnings: [],
      counts: {
        users: 1,
        libraries: libraries.length,
        series: firstSeries.totalElements,
        books: firstBooks.totalElements,
        collections: firstCollections.totalElements,
        readLists: firstReadLists.totalElements,
      },
    };
  }

  async fetchLibraryRoots(config: KomgaConnectionConfig): Promise<string[]> {
    await this.getCurrentUser(config);
    return (await this.getLibraries(config)).map((library) => library.root);
  }

  private async getAllPages<T>(fetcher: (page: number) => Promise<PageEnvelope<T>>, label: string): Promise<T[]> {
    const items: T[] = [];
    const seen = new Set<string>();
    for (let page = 0; page < MAX_PAGE_COUNT; page++) {
      const result = await fetcher(page);
      const countBeforePage = items.length;
      for (const item of result.content) {
        const id = extractId(item);
        if (id) {
          if (seen.has(id)) continue;
          seen.add(id);
        }
        items.push(item);
      }
      if (
        result.content.length === 0 ||
        // Guards against a server that ignores `page` and replays the same rows indefinitely.
        items.length === countBeforePage ||
        result.last ||
        (result.totalPages > 0 && page + 1 >= result.totalPages) ||
        (result.totalElements > 0 && items.length >= result.totalElements) ||
        (result.totalElements === 0 && result.content.length < PAGE_SIZE)
      ) {
        return items;
      }
    }
    throw new BadRequestException(`Komga ${label} pagination exceeded the safety limit`);
  }

  private requestJson(config: KomgaConnectionConfig, path: string, options: JsonRequestOptions = {}): Promise<unknown> {
    return requestKomgaJson(config, path, options);
  }
}

export async function requestKomgaJson(config: KomgaConnectionConfig, path: string, options: JsonRequestOptions = {}): Promise<unknown> {
  const requestUrl = new URL(path, `${config.baseUrl}/`);
  if (requestUrl.origin !== config.baseUrl) throw new BadRequestException('Komga request URL left the configured origin');

  let lastError: unknown;
  const retryable = options.retryable ?? (options.method ?? 'GET') === 'GET';
  const attempts = retryable ? MAX_REQUEST_ATTEMPTS : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await requestJsonOnce(config, requestUrl, options);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientTransportError(error)) break;
    }
  }
  throw toSafeRequestException(lastError);
}

export async function resolvePinnedAddress(
  hostname: string,
  allowPrivateNetwork: boolean,
  resolver: AddressResolver = (value, options) => lookup(value, options),
): Promise<PinnedAddress> {
  let resolved: Array<{ address: string; family: number }>;
  try {
    const normalizedHostname = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
    resolved = await resolver(normalizedHostname, { all: true, verbatim: true });
  } catch {
    throw new BadRequestException('Unable to resolve the Komga server');
  }
  if (resolved.length === 0) throw new BadRequestException('Unable to resolve the Komga server');

  for (const entry of resolved) {
    await ensureSafeRemoteHost(entry.address, { allowPrivate: allowPrivateNetwork });
  }
  const selected = resolved[0];
  if (selected.family !== 4 && selected.family !== 6) {
    throw new BadRequestException('Komga server resolved to an unsupported address');
  }
  return { address: selected.address, family: selected.family };
}

function requestJsonOnce(config: KomgaConnectionConfig, url: URL, options: JsonRequestOptions): Promise<unknown> {
  return new Promise((resolve, reject) => {
    void resolvePinnedAddress(url.hostname, config.allowPrivateNetwork)
      .then((pinned) => {
        const requestFactory: RequestFactory = url.protocol === 'https:' ? httpsRequest : httpRequest;
        const request = requestFactory(
          url,
          {
            method: options.method ?? 'GET',
            headers: {
              accept: 'application/json',
              'X-API-Key': config.apiToken,
            },
            lookup: createPinnedLookup(pinned) as never,
          },
          (response) => readJsonResponse(response, options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES, resolve, reject),
        );
        request.setTimeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS, () => request.destroy(new TransportError('timeout')));
        request.on('error', (error) => reject(error instanceof TransportError ? error : new TransportError('network')));
        request.end();
      })
      .catch(reject);
  });
}

export function createPinnedLookup(pinned: PinnedAddress) {
  return (
    _hostname: string,
    lookupOptions: { all?: boolean } | undefined,
    callback: (error: Error | null, address: string | Array<{ address: string; family: number }>, family?: number) => void,
  ): void => {
    if (lookupOptions?.all) {
      callback(null, [{ address: pinned.address, family: pinned.family }]);
      return;
    }
    callback(null, pinned.address, pinned.family);
  };
}

function readJsonResponse(
  response: IncomingMessage,
  maxResponseBytes: number,
  resolve: (value: unknown) => void,
  reject: (reason?: unknown) => void,
): void {
  const statusCode = response.statusCode ?? 0;
  if (statusCode >= 300 && statusCode < 400) {
    response.resume();
    reject(new TransportError('redirect', statusCode));
    return;
  }
  if (statusCode < 200 || statusCode >= 300) {
    response.resume();
    reject(new TransportError('status', statusCode));
    return;
  }

  const declaredLength = Number(response.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    response.destroy();
    reject(new TransportError('response-size'));
    return;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  response.on('data', (chunk: Buffer | string) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxResponseBytes) {
      response.destroy(new TransportError('response-size'));
      return;
    }
    chunks.push(buffer);
  });
  response.on('error', (error) => reject(error instanceof TransportError ? error : new TransportError('network')));
  response.on('end', () => {
    if (totalBytes > maxResponseBytes) return;
    try {
      resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    } catch {
      reject(new TransportError('json'));
    }
  });
}

class TransportError extends Error {
  constructor(
    readonly kind: 'timeout' | 'network' | 'response-size' | 'redirect' | 'status' | 'json',
    readonly statusCode: number | null = null,
  ) {
    super(kind);
  }
}

function isTransientTransportError(error: unknown): boolean {
  return (
    error instanceof TransportError &&
    (error.kind === 'timeout' || error.kind === 'network' || (error.kind === 'status' && TRANSIENT_STATUS_CODES.has(error.statusCode ?? 0)))
  );
}

function toSafeRequestException(error: unknown): BadRequestException {
  if (error instanceof BadRequestException) return error;
  if (!(error instanceof TransportError)) return new BadRequestException('Komga request failed');
  if (error.kind === 'timeout') return new BadRequestException('Komga request timed out');
  if (error.kind === 'response-size') return new BadRequestException('Komga response exceeded the allowed size');
  if (error.kind === 'redirect') return new BadRequestException('Komga redirects are not allowed');
  if (error.kind === 'json') return new BadRequestException('Komga returned invalid JSON');
  if (error.kind === 'status') {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new BadRequestException('Komga authentication or authorization failed');
    }
    return new BadRequestException(`Komga request failed with status ${error.statusCode ?? 'unknown'}`);
  }
  return new BadRequestException('Could not reach the Komga server');
}

function mapPage<T>(raw: unknown, mapper: (value: unknown) => T | null): PageEnvelope<T> {
  const row = asRecord(raw);
  return {
    content: asArray(row.content).map(mapper).filter(isPresent),
    totalElements: nonNegativeInteger(row.totalElements),
    totalPages: nonNegativeInteger(row.totalPages),
    number: nonNegativeInteger(row.number),
    size: nonNegativeInteger(row.size),
    last: row.last === true,
  };
}

function mapUser(raw: unknown): KomgaUserRecord | null {
  const row = asRecord(raw);
  const id = requiredString(row.id);
  const email = requiredString(row.email);
  if (!id || !email) return null;
  return {
    id,
    email,
    roles: asArray(row.roles).map(nullableString).filter(isPresent),
  };
}

function mapLibrary(raw: unknown): KomgaLibraryRecord | null {
  const row = asRecord(raw);
  const id = requiredString(row.id);
  const root = requiredString(row.root);
  if (!id || !root) return null;
  return {
    id,
    name: nullableString(row.name),
    root,
  };
}

function mapBook(raw: unknown): KomgaBookRecord | null {
  const row = asRecord(raw);
  const id = requiredString(row.id);
  if (!id) return null;
  const metadata = asRecord(row.metadata);
  const media = asRecord(row.media);
  const readProgress = asRecord(row.readProgress);
  return {
    id,
    seriesId: nullableString(row.seriesId),
    seriesTitle: nullableString(row.seriesTitle),
    number: finiteNumber(row.number),
    name: nullableString(row.name),
    url: nullableString(row.url),
    fileHash: nullableString(row.fileHash),
    libraryId: nullableString(row.libraryId),
    deleted: typeof row.deleted === 'boolean' ? row.deleted : null,
    media:
      Object.keys(media).length === 0
        ? null
        : {
            pagesCount: finiteNumber(media.pagesCount),
            mediaType: nullableString(media.mediaType),
            mediaProfile: nullableString(media.mediaProfile),
          },
    metadata:
      Object.keys(metadata).length === 0
        ? null
        : {
            title: nullableString(metadata.title),
            summary: nullableString(metadata.summary),
            number: nullableString(metadata.number),
            isbn: nullableString(metadata.isbn),
            releaseDate: nullableString(metadata.releaseDate),
            authors: asArray(metadata.authors)
              .map((author) => {
                const value = asRecord(author);
                const name = requiredString(value.name);
                return name ? { name, role: nullableString(value.role) } : null;
              })
              .filter(isPresent),
            tags: asArray(metadata.tags).map(nullableString).filter(isPresent),
          },
    readProgress:
      Object.keys(readProgress).length === 0
        ? null
        : {
            page: finiteNumber(readProgress.page),
            completed: typeof readProgress.completed === 'boolean' ? readProgress.completed : null,
            created: timestampValue(readProgress.created),
            lastModified: timestampValue(readProgress.lastModified),
            readDate: timestampValue(readProgress.readDate),
          },
  };
}

function mapSeries(raw: unknown): KomgaSeriesRecord | null {
  const row = asRecord(raw);
  const id = requiredString(row.id);
  if (!id) return null;
  const metadata = asRecord(row.metadata);
  return {
    id,
    name: nullableString(row.name),
    libraryId: nullableString(row.libraryId),
    url: nullableString(row.url),
    metadata:
      Object.keys(metadata).length === 0
        ? null
        : {
            title: nullableString(metadata.title),
            summary: nullableString(metadata.summary),
            publisher: nullableString(metadata.publisher),
            language: nullableString(metadata.language),
            genres: asArray(metadata.genres).map(nullableString).filter(isPresent),
            tags: asArray(metadata.tags).map(nullableString).filter(isPresent),
          },
  };
}

function mapCollection(raw: unknown): KomgaCollectionRecord | null {
  const row = asRecord(raw);
  const id = requiredString(row.id);
  const name = requiredString(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    seriesIds: asArray(row.seriesIds).map(nullableString).filter(isPresent),
    ordered: typeof row.ordered === 'boolean' ? row.ordered : null,
  };
}

function mapReadList(raw: unknown): KomgaReadListRecord | null {
  const row = asRecord(raw);
  const id = requiredString(row.id);
  const name = requiredString(row.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    bookIds: asArray(row.bookIds).map(nullableString).filter(isPresent),
    ordered: typeof row.ordered === 'boolean' ? row.ordered : null,
  };
}

function extractId(value: unknown): string | null {
  return requiredString(asRecord(value).id);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function requiredString(value: unknown): string | null {
  return nullableString(value);
}

function nullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nonNegativeInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function timestampValue(value: unknown): string | number | Date | null {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value)) || value instanceof Date ? value : null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
