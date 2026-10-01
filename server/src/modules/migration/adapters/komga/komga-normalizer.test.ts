import { describe, expect, it } from 'vitest';

import { KomgaNormalizer } from './komga-normalizer';
import type { KomgaBookRecord, KomgaSourceRecords } from './komga-source.types';

const normalizer = new KomgaNormalizer();

function book(overrides: Partial<KomgaBookRecord> = {}): KomgaBookRecord {
  return {
    id: 'book-1',
    seriesId: 'series-1',
    seriesTitle: 'Harbor Cycle',
    url: '/comics/harbor/01.cbz',
    fileHash: 'abc123',
    media: { pagesCount: 20, mediaType: 'application/zip' },
    metadata: {
      title: 'The Glass Harbor',
      summary: 'Synthetic description',
      number: '1',
      isbn: '978-1-4028-9462-6',
      releaseDate: '2024-05-01',
      authors: [
        { name: 'Mara Vale', role: 'writer' },
        { name: 'Ira Stone', role: 'penciller' },
      ],
      tags: ['Favorite', 'favorite'],
    },
    readProgress: {
      page: 5,
      completed: false,
      created: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-02T00:00:00.000Z',
    },
    ...overrides,
  };
}

function source(overrides: Partial<KomgaSourceRecords> = {}): KomgaSourceRecords {
  return {
    sourceVersion: '1.27.1',
    authenticatedUserId: 'user-1',
    users: [{ id: 'user-1', email: 'maya@example.com', roles: ['ADMIN'] }],
    libraries: [{ id: 'lib-1', name: 'Comics', root: '/comics/' }],
    series: [
      {
        id: 'series-1',
        name: 'Harbor Cycle',
        metadata: {
          title: 'Harbor Cycle',
          publisher: 'North Light Press',
          language: 'en',
          genres: ['Fantasy', 'Adventure'],
          tags: ['series-tag'],
          summary: 'Series summary',
        },
      },
    ],
    books: [book()],
    collections: [{ id: 'col-1', name: 'Favorites', seriesIds: ['series-1'] }],
    readLists: [{ id: 'rl-1', name: 'Tonight', bookIds: ['book-1'] }],
    ...overrides,
  };
}

describe('KomgaNormalizer', () => {
  it('normalizes users, metadata, authors, progress, shelves, and domains', () => {
    const result = normalizer.normalize(source());

    expect(result.sourceVersion).toBe('1.27.1');
    expect(result.pathPrefixes).toEqual(['/comics']);
    expect(result.data.users).toEqual([{ sourceUserId: 'user-1', username: 'maya@example.com', name: null, email: 'maya@example.com' }]);
    expect(result.data.books[0]).toMatchObject({
      sourceBookId: 'book-1',
      title: 'The Glass Harbor',
      author: 'Mara Vale',
      isbn13: '9781402894626',
      description: 'Synthetic description',
      publisher: 'North Light Press',
      publishedYear: 2024,
      language: 'en',
      pageCount: 20,
      seriesName: 'Harbor Cycle',
      seriesIndex: '1',
      filePath: '/comics/harbor/01.cbz',
      genres: ['Fantasy', 'Adventure'],
      tags: ['Favorite', 'series-tag'],
    });
    expect(result.data.books[0]?.authors).toEqual([expect.objectContaining({ name: 'Mara Vale', displayOrder: 0 })]);
    expect(result.data.userBookStatuses).toEqual([
      expect.objectContaining({ sourceUserId: 'user-1', sourceBookId: 'book-1', status: 'reading', percentage: 25 }),
    ]);
    expect(result.data.userFileProgress).toEqual([
      expect.objectContaining({ sourceUserId: 'user-1', sourceBookId: 'book-1', pageNumber: 5, percentage: 25 }),
    ]);
    expect(result.data.shelves).toEqual([
      { sourceShelfId: 'collection:col-1', sourceUserId: 'user-1', name: 'Collection: Favorites' },
      { sourceShelfId: 'readlist:rl-1', sourceUserId: 'user-1', name: 'Read list: Tonight' },
    ]);
    expect(result.data.shelfBooks).toEqual([
      expect.objectContaining({ sourceShelfId: 'collection:col-1', sourceBookId: 'book-1', position: 0 }),
      expect.objectContaining({ sourceShelfId: 'readlist:rl-1', sourceBookId: 'book-1', position: 0 }),
    ]);
    expect(result.data.availableDomains).toEqual({
      metadata: true,
      authors: true,
      narrators: false,
      genres: true,
      tags: true,
      userBookStatuses: true,
      readingProgress: true,
      readingSessions: false,
      bookmarks: false,
      annotations: false,
      shelves: true,
      covers: false,
    });
  });

  it('marks completed progress as read and skips deleted books', () => {
    const result = normalizer.normalize(
      source({
        books: [
          book({ id: 'book-2', deleted: true }),
          book({
            id: 'book-3',
            readProgress: { page: 20, completed: true, readDate: '2024-03-01T00:00:00.000Z', lastModified: '2024-03-01T00:00:00.000Z' },
          }),
        ],
        collections: [],
        readLists: [],
      }),
    );

    expect(result.data.books.map((entry) => entry.sourceBookId)).toEqual(['book-3']);
    expect(result.data.userBookStatuses[0]).toMatchObject({ sourceBookId: 'book-3', status: 'read', percentage: 100 });
    expect(result.counters.deletedBooksSkipped).toBe(1);
  });

  it('keeps progress only for the authenticated API key user', () => {
    const result = normalizer.normalize(
      source({
        authenticatedUserId: 'user-1',
        users: [
          { id: 'user-1', email: 'maya@example.com', roles: ['ADMIN'] },
          { id: 'user-2', email: 'other@example.com', roles: ['USER'] },
        ],
        warnings: ['Komga read progress is only available for the authenticated API key user; other users are listed without progress.'],
      }),
    );

    expect(result.data.users).toHaveLength(2);
    expect(result.data.userBookStatuses.every((status) => status.sourceUserId === 'user-1')).toBe(true);
    expect(result.warnings).toContain(
      'Komga read progress is only available for the authenticated API key user; other users are listed without progress.',
    );
  });
});
