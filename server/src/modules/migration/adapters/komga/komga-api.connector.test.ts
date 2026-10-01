import { BadRequestException } from '@nestjs/common';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPinnedLookup, KomgaApiConnector, requestKomgaJson, resolvePinnedAddress } from './komga-api.connector';

const config = {
  baseUrl: 'https://komga.example.com',
  apiToken: 'super-secret-token',
  allowPrivateNetwork: false,
};

type RequestJson = (configValue: typeof config, path: string, options?: Record<string, unknown>) => Promise<unknown>;

afterEach(() => vi.restoreAllMocks());

function mockRequest(connector: KomgaApiConnector) {
  return vi.spyOn(connector as unknown as { requestJson: RequestJson }, 'requestJson');
}

describe('KomgaApiConnector validation and field selection', () => {
  it('reads the current user and best-effort version info', async () => {
    const connector = new KomgaApiConnector();
    const request = mockRequest(connector)
      .mockResolvedValueOnce({ build: { version: '1.27.1' } })
      .mockResolvedValueOnce({ id: 'u1', email: 'admin@example.com', roles: ['ADMIN'], password: 'discard' });

    await expect(connector.getStatus(config)).resolves.toEqual({ sourceVersion: '1.27.1' });
    await expect(connector.getCurrentUser(config)).resolves.toEqual({ id: 'u1', email: 'admin@example.com', roles: ['ADMIN'] });
    expect(request).toHaveBeenNthCalledWith(1, config, '/actuator/info');
    expect(request).toHaveBeenNthCalledWith(2, config, '/api/v2/users/me');
  });

  it('treats missing actuator info as a null version instead of failing validation', async () => {
    const connector = new KomgaApiConnector();
    mockRequest(connector).mockRejectedValueOnce(new BadRequestException('Komga request failed with status 404'));
    await expect(connector.getStatus(config)).resolves.toEqual({ sourceVersion: null });
  });

  it('maps only migration fields from books and series pages', async () => {
    const connector = new KomgaApiConnector();
    mockRequest(connector)
      .mockResolvedValueOnce({
        content: [
          {
            id: 'b1',
            seriesId: 's1',
            seriesTitle: 'Harbor',
            url: '/comics/harbor/01.cbz',
            secret: 'discard-me',
            media: { pagesCount: 24, mediaType: 'application/zip' },
            metadata: {
              title: 'Issue 1',
              summary: 'Start',
              isbn: '9781402894626',
              releaseDate: '2024-01-02',
              authors: [{ name: 'Mara Vale', role: 'writer', avatar: '/x' }],
              tags: ['favorite'],
            },
            readProgress: { page: 6, completed: false, lastModified: '2024-02-01T00:00:00Z' },
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 200,
        last: true,
      })
      .mockResolvedValueOnce({
        content: [
          {
            id: 's1',
            name: 'Harbor',
            metadata: { title: 'Harbor', publisher: 'North Light', language: 'en', genres: ['Fantasy'], tags: ['series-tag'] },
          },
        ],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 200,
        last: true,
      });

    await expect(connector.getBooksPage(config, 0)).resolves.toEqual({
      content: [
        expect.objectContaining({
          id: 'b1',
          seriesTitle: 'Harbor',
          url: '/comics/harbor/01.cbz',
          metadata: expect.objectContaining({ title: 'Issue 1', authors: [{ name: 'Mara Vale', role: 'writer' }] }),
          readProgress: expect.objectContaining({ page: 6, completed: false }),
        }),
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
      last: true,
    });
    const seriesPage = await connector.getSeriesPage(config, 0);
    expect(seriesPage).toMatchObject({
      content: [expect.objectContaining({ id: 's1', metadata: expect.objectContaining({ publisher: 'North Light', genres: ['Fantasy'] }) })],
    });
    expect(JSON.stringify(seriesPage)).not.toContain('discard');
  });

  it('returns null when listing users is forbidden', async () => {
    const connector = new KomgaApiConnector();
    mockRequest(connector).mockRejectedValueOnce(new BadRequestException('Komga authentication or authorization failed'));
    await expect(connector.getUsers(config)).resolves.toBeNull();
  });
});

describe('KomgaApiConnector pagination and snapshot counts', () => {
  it('builds snapshot counts from first pages without exporting the whole library', async () => {
    const connector = new KomgaApiConnector();
    vi.spyOn(connector, 'getStatus').mockResolvedValue({ sourceVersion: '1.27.1' });
    vi.spyOn(connector, 'getCurrentUser').mockResolvedValue({ id: 'u1', email: 'admin@example.com', roles: ['ADMIN'] });
    vi.spyOn(connector, 'getUsers').mockResolvedValue([
      { id: 'u1', email: 'admin@example.com', roles: ['ADMIN'] },
      { id: 'u2', email: 'reader@example.com', roles: ['USER'] },
    ]);
    vi.spyOn(connector, 'getLibraries').mockResolvedValue([{ id: 'lib1', name: 'Comics', root: '/comics' }]);
    vi.spyOn(connector, 'getBooksPage').mockResolvedValue({ content: [], totalElements: 12_000, totalPages: 60, number: 0, size: 200, last: false });
    vi.spyOn(connector, 'getSeriesPage').mockResolvedValue({ content: [], totalElements: 400, totalPages: 2, number: 0, size: 200, last: false });
    vi.spyOn(connector, 'getCollectionsPage').mockResolvedValue({ content: [], totalElements: 3, totalPages: 1, number: 0, size: 200, last: true });
    vi.spyOn(connector, 'getReadListsPage').mockResolvedValue({ content: [], totalElements: 5, totalPages: 1, number: 0, size: 200, last: true });

    await expect(connector.fetchSnapshotSummary(config)).resolves.toEqual({
      sourceVersion: '1.27.1',
      warnings: ['Komga read progress is only available for the authenticated API key user; other users are listed without progress.'],
      counts: { users: 2, libraries: 1, series: 400, books: 12_000, collections: 3, readLists: 5 },
    });
  });

  it('stops paginating a server that ignores the page parameter', async () => {
    const connector = new KomgaApiConnector();
    vi.spyOn(connector, 'getStatus').mockResolvedValue({ sourceVersion: null });
    vi.spyOn(connector, 'getCurrentUser').mockResolvedValue({ id: 'u1', email: 'admin@example.com', roles: ['ADMIN'] });
    vi.spyOn(connector, 'getUsers').mockResolvedValue([{ id: 'u1', email: 'admin@example.com', roles: ['ADMIN'] }]);
    vi.spyOn(connector, 'getLibraries').mockResolvedValue([{ id: 'lib1', root: '/comics' }]);
    vi.spyOn(connector, 'getSeriesPage').mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 200, last: true });
    vi.spyOn(connector, 'getCollectionsPage').mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 200, last: true });
    vi.spyOn(connector, 'getReadListsPage').mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 200, last: true });

    const pages = vi.spyOn(connector, 'getBooksPage').mockImplementation((_config, page) =>
      Promise.resolve({
        content: Array.from({ length: 200 }, (_, index) => ({ id: `b-${index}` })),
        totalElements: 100_000,
        totalPages: 0,
        number: page,
        size: 200,
        last: false,
      }),
    );

    const result = await connector.fetchSourceRecords(config);
    expect(pages.mock.calls).toHaveLength(2);
    expect(result.books).toHaveLength(200);
  });
});

describe('Komga HTTP safety', () => {
  it('rejects private targets unless access is explicitly enabled', async () => {
    await expect(requestKomgaJson({ ...config, baseUrl: 'http://127.0.0.1:9' }, '/api/v2/users/me')).rejects.toThrow('private or local');
  });

  it('sends the API key header and uses an explicitly allowed private target', async () => {
    await withServer(
      (request, response) => {
        expect(request.headers['x-api-key']).toBe(config.apiToken);
        response.setHeader('content-type', 'application/json');
        response.end('{"ok":true}');
      },
      async (baseUrl) => {
        await expect(requestKomgaJson({ ...config, baseUrl, allowPrivateNetwork: true }, '/api/v2/users/me')).resolves.toEqual({ ok: true });
      },
    );
  });

  it('rejects redirects, streamed oversized responses, and timeouts', async () => {
    await withServer(
      (_request, response) => {
        response.statusCode = 302;
        response.setHeader('location', 'http://127.0.0.1/private');
        response.end();
      },
      async (baseUrl) => {
        await expect(requestKomgaJson({ ...config, baseUrl, allowPrivateNetwork: true }, '/redirect')).rejects.toThrow('redirects are not allowed');
      },
    );

    await withServer(
      (_request, response) => {
        response.write('{"payload":"');
        response.write('x'.repeat(100));
        response.end('"}');
      },
      async (baseUrl) => {
        await expect(requestKomgaJson({ ...config, baseUrl, allowPrivateNetwork: true }, '/large', { maxResponseBytes: 32 })).rejects.toThrow(
          'exceeded the allowed size',
        );
      },
    );

    await withServer(
      () => undefined,
      async (baseUrl) => {
        await expect(requestKomgaJson({ ...config, baseUrl, allowPrivateNetwork: true }, '/slow', { timeoutMs: 20 })).rejects.toThrow('timed out');
      },
    );
  });

  it('does not expose credentials or upstream response bodies in errors', async () => {
    await withServer(
      (_request, response) => {
        response.statusCode = 500;
        response.end(`failure included ${config.apiToken}`);
      },
      async (baseUrl) => {
        const error = await requestKomgaJson({ ...config, baseUrl, allowPrivateNetwork: true }, '/failure').catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(BadRequestException);
        expect(String(error)).not.toContain(config.apiToken);
        expect(String(error)).not.toContain('failure included');
      },
    );
  });

  it('pins the validated DNS answer so the connection lookup cannot re-resolve the hostname', async () => {
    const resolver = vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    const pinned = await resolvePinnedAddress('komga.example.com', false, resolver as never);
    expect(resolver).toHaveBeenCalledTimes(1);

    const lookupFn = createPinnedLookup(pinned);
    const callback = vi.fn();
    lookupFn('komga.example.com', {}, callback);
    lookupFn('komga.example.com', {}, callback);

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenNthCalledWith(1, null, '93.184.216.34', 4);
    expect(callback).toHaveBeenNthCalledWith(2, null, '93.184.216.34', 4);
  });
});

async function withServer(handler: Parameters<typeof createServer>[0], run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}
