import { describe, expect, it, vi } from 'vitest';

import { KomgaSourceAdapter } from './komga-source.adapter';
import type { KomgaNormalizationResult, KomgaSourceRecords } from './komga-source.types';

const apiConfig = {
  baseUrl: 'https://komga.example.com',
  apiToken: 'secret',
  allowPrivateNetwork: false,
};

function records(): KomgaSourceRecords {
  return {
    sourceVersion: '1.27.1',
    authenticatedUserId: 'u1',
    users: [],
    libraries: [],
    series: [],
    books: [],
    collections: [],
    readLists: [],
  };
}

function normalized(): KomgaNormalizationResult {
  return {
    sourceVersion: '1.27.1',
    pathPrefixes: ['/comics'],
    warnings: ['one warning'],
    counters: {
      invalidUsersSkipped: 0,
      invalidBooksSkipped: 0,
      deletedBooksSkipped: 0,
      orphanedProgressSkipped: 0,
      invalidCollectionsSkipped: 0,
      invalidReadListsSkipped: 0,
      orphanedShelfBooksSkipped: 0,
      shelfNameCollisions: 0,
    },
    data: {
      users: [{ sourceUserId: 'u1', username: 'reader@example.com', name: null, email: 'reader@example.com' }],
      books: [
        {
          sourceBookId: 'b1',
          title: 'Book',
          author: null,
          subtitle: null,
          isbn10: null,
          isbn13: null,
          description: null,
          publisher: null,
          publishedYear: null,
          language: null,
          filePath: '/comics/book.cbz',
          fileHash: null,
          files: [
            {
              sourceFileId: 'b1:file',
              sourceBookId: 'b1',
              filePath: '/comics/book.cbz',
              fileHash: null,
              fileName: 'book.cbz',
              fileSubPath: 'book.cbz',
              durationSeconds: null,
              format: 'cbz',
              sortOrder: 0,
            },
          ],
          genres: [],
          tags: [],
        },
      ],
      userBookStatuses: [],
      userFileProgress: [],
      readingSessions: [],
      bookmarks: [],
      annotations: [],
      shelves: [],
      shelfBooks: [],
    },
  };
}

function buildAdapter() {
  const sourceRecords = records();
  const normalizationResult = normalized();
  const connector = {
    fetchSourceRecords: vi.fn().mockResolvedValue(sourceRecords),
    fetchSnapshotSummary: vi.fn().mockResolvedValue({
      sourceVersion: '1.27.1',
      warnings: ['summary warning'],
      counts: { users: 1, libraries: 1, series: 1, books: 1, collections: 0, readLists: 0 },
    }),
    fetchLibraryRoots: vi.fn().mockResolvedValue(['/comics/', '/comics', '/manga\\']),
  };
  const normalizer = { normalize: vi.fn().mockReturnValue(normalizationResult) };
  return {
    adapter: new KomgaSourceAdapter(connector as never, normalizer as never),
    connector,
    normalizer,
    sourceRecords,
    normalizationResult,
  };
}

describe('KomgaSourceAdapter', () => {
  it('validates from the summary without exporting the whole library', async () => {
    const { adapter, connector, normalizer } = buildAdapter();

    await expect(adapter.validate(apiConfig)).resolves.toEqual({
      ok: true,
      sourceType: 'komga',
      sourceVersion: '1.27.1',
      missingTables: [],
      warnings: ['summary warning'],
      counts: { users: 1, libraries: 1, series: 1, books: 1, collections: 0, readLists: 0 },
    });
    expect(connector.fetchSnapshotSummary).toHaveBeenCalledWith(apiConfig);
    expect(connector.fetchSourceRecords).not.toHaveBeenCalled();
    expect(normalizer.normalize).not.toHaveBeenCalled();
  });

  it('builds a stable snapshot and returns the normalized export contract', async () => {
    const { adapter, connector, normalizationResult } = buildAdapter();
    const snapshot = await adapter.snapshot(apiConfig);

    expect(snapshot).toMatchObject({
      sourceType: 'komga',
      sourceVersion: '1.27.1',
      counts: { users: 1, libraries: 1, series: 1, books: 1, collections: 0, readLists: 0 },
    });
    expect(Date.parse(snapshot.generatedAt)).not.toBeNaN();
    expect(connector.fetchSnapshotSummary).toHaveBeenCalledWith(apiConfig);
    await expect(adapter.exportData(apiConfig)).resolves.toBe(normalizationResult.data);
  });

  it('normalizes unique path prefixes from live library roots', async () => {
    const { adapter } = buildAdapter();
    await expect(adapter.fetchPathPrefixes(apiConfig)).resolves.toEqual(['/comics', '/manga']);
  });
});
