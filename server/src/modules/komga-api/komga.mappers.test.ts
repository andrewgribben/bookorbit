import { BadRequestException, NotFoundException } from '@nestjs/common';

import {
  bookSourceFixture,
  collectionSourceFixture,
  librarySourceFixture,
  readListSourceFixture,
  seriesSourceFixture,
} from './komga-response-fixtures';
import { clampKomgaPageSize, decodeKomgaId, encodeKomgaId, parseSeriesNumber, resolveKomgaPagination, toKomgaPage } from './komga-ids';
import {
  komgaMediaProfile,
  komgaMediaStatus,
  komgaMediaType,
  toKomgaBook,
  toKomgaCollection,
  toKomgaLibrary,
  toKomgaReadList,
  toKomgaReadProgress,
  toKomgaSeries,
  toKomgaUser,
} from './komga.mappers';
import type { RequestUser } from '../../common/types/request-user';
import { Permission } from '@bookorbit/types';

function requestUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 7,
    username: 'reader',
    name: 'Reader',
    email: null,
    active: true,
    isSuperuser: false,
    isDefaultPassword: false,
    tokenVersion: 1,
    settings: {},
    avatarUrl: null,
    provisioningMethod: 'local',
    permissions: [],
    contentFilters: undefined,
    ...overrides,
  } as unknown as RequestUser;
}

describe('Komga ids and paging', () => {
  it('round-trips a BookOrbit integer through the Komga string id', () => {
    expect(encodeKomgaId(1287)).toBe('1287');
    expect(decodeKomgaId('1287', 'book')).toBe(1287);
  });

  it('rejects ids that cannot name a row instead of coercing them', () => {
    for (const invalid of ['abc', '1.5', '-4', '0', '12a', '99999999999']) {
      expect(() => decodeKomgaId(invalid, 'book')).toThrow(BadRequestException);
    }
  });

  it('answers an empty id with not found, the way a trailing-slash request reaches it', () => {
    expect(() => decodeKomgaId('', 'series')).toThrow(NotFoundException);
  });

  it('caps and validates the requested page size', () => {
    expect(clampKomgaPageSize(undefined)).toBe(20);
    expect(clampKomgaPageSize(50)).toBe(50);
    expect(clampKomgaPageSize(10_000)).toBe(500);
    expect(() => clampKomgaPageSize(0)).toThrow(BadRequestException);
    expect(() => clampKomgaPageSize(Number.NaN)).toThrow(BadRequestException);
  });

  it('caps unpaged requests to the maximum page size', () => {
    expect(resolveKomgaPagination({ unpaged: true })).toEqual({ page: 0, size: 500 });
    expect(() => resolveKomgaPagination({ page: -1 })).toThrow(BadRequestException);
    expect(resolveKomgaPagination({ page: 2, size: 20 })).toEqual({ page: 2, size: 20 });
  });

  it('builds the envelope Komga clients read', () => {
    const page = toKomgaPage(['a', 'b'], 5, 0, 2, true);

    expect(page.totalElements).toBe(5);
    expect(page.totalPages).toBe(3);
    expect(page.first).toBe(true);
    expect(page.last).toBe(false);
    expect(page.numberOfElements).toBe(2);
    expect(page.pageable).toEqual({
      offset: 0,
      pageNumber: 0,
      pageSize: 2,
      paged: true,
      sort: { empty: false, sorted: true, unsorted: false },
      unpaged: false,
    });
    expect(toKomgaPage([], 0, 0, 20, false).last).toBe(true);
  });
});

describe('Komga media mapping', () => {
  it('maps comic containers to their Komga media type', () => {
    expect(komgaMediaType('cbz')).toBe('application/vnd.comicbook+zip');
    expect(komgaMediaType('CBR')).toBe('application/vnd.comicbook-rar');
    expect(komgaMediaType('cb7')).toBe('application/vnd.comicbook+zip');
    expect(komgaMediaType('epub')).toBe('application/epub+zip');
    expect(komgaMediaType('kepub')).toBe('application/epub+zip');
    expect(komgaMediaType('pdf')).toBe('application/pdf');
    expect(komgaMediaType('m4b')).toBe('audio/mp4');
  });

  it('falls back to octet-stream for formats Komga has no type for', () => {
    expect(komgaMediaType(null)).toBe('application/octet-stream');
    expect(komgaMediaType('mobi')).toBe('application/octet-stream');
  });

  it('names only the reader profiles Komga itself serves', () => {
    expect(komgaMediaProfile('cbz')).toBe('DIVINA');
    expect(komgaMediaProfile('epub')).toBe('EPUB');
    expect(komgaMediaProfile('pdf')).toBe('PDF');
    expect(komgaMediaProfile('mobi')).toBe('OTHER');
    expect(komgaMediaProfile(null)).toBe('OTHER');
  });

  it('maps BookOrbit book status to Komga media status', () => {
    expect(komgaMediaStatus('present')).toBe('READY');
    expect(komgaMediaStatus('missing')).toBe('ERROR');
    expect(komgaMediaStatus('processing')).toBe('UNKNOWN');
  });
});

describe('Komga book mapping', () => {
  it('maps a comic with a series and a file', () => {
    const book = toKomgaBook(bookSourceFixture());

    expect(book.id).toBe('1287');
    expect(book.libraryId).toBe('3');
    expect(book.seriesId).toBe('91');
    expect(book.seriesTitle).toBe('Batman');
    expect(book.oneshot).toBe(false);
    expect(book.deleted).toBe(false);
    expect(book.number).toBe(1);
    expect(book.metadata.number).toBe('1');
    expect(book.metadata.numberSort).toBe(1);
    expect(book.metadata.authors).toEqual([
      { name: 'Frank Miller', role: 'writer' },
      { name: 'David Mazzucchelli', role: 'writer' },
    ]);
    expect(book.media.mediaType).toBe('application/vnd.comicbook+zip');
    expect(book.media.pagesCount).toBe(96);
    expect(book.size).toBe('51380224');
    expect(book.sizeBytes).toBe(51380224);
    expect(book.fileHash).toBe('9f2c4e1a5b7d3c8e9f0a1b2c3d4e5f60');
    expect(book.fileLastModified).toBe('2026-09-18T18:03:00.000Z');
    expect(book.url).toBe('/komga/api/v1/books/1287');
  });

  it('marks a standalone missing book as a deleted oneshot with no series', () => {
    const book = toKomgaBook(bookSourceFixture({ seriesId: null, seriesName: null, seriesIndex: null, status: 'missing', primaryFile: null }));

    expect(book.oneshot).toBe(true);
    expect(book.seriesId).toBe('');
    expect(book.seriesTitle).toBe('');
    expect(book.deleted).toBe(true);
    expect(book.media.status).toBe('ERROR');
    expect(book.readProgress).toBeUndefined();
  });

  it('reports an unhashed, unsized book without inventing numbers', () => {
    const book = toKomgaBook(
      bookSourceFixture({
        pageCount: null,
        primaryFile: { id: 1, format: 'mobi', role: 'content', sizeBytes: null, fileHash: null, mtime: null },
      }),
    );

    expect(book.fileHash).toBe('');
    expect(book.size).toBe('0');
    expect(book.sizeBytes).toBe(0);
    expect(book.media.mediaProfile).toBe('OTHER');
    expect(book.media.pagesCount).toBe(0);
  });

  it('carries read progress when the user has one', () => {
    const book = toKomgaBook(
      bookSourceFixture({
        readStatus: 'read',
        progress: { pageNumber: 96, percentage: 100, lastModified: '2026-09-19T10:00:00.000Z', lastReadAt: '2026-09-19T09:00:00.000Z' },
      }),
    );

    expect(book.readProgress).toEqual({
      completed: true,
      created: '2026-09-19T10:00:00.000Z',
      deviceId: '',
      deviceName: '',
      lastModified: '2026-09-19T10:00:00.000Z',
      page: 96,
      readDate: '2026-09-19T09:00:00.000Z',
    });
  });

  it('treats a manually marked read book as completed without a progress row', () => {
    const progress = toKomgaReadProgress(
      { pageNumber: null, percentage: 0, lastModified: '2026-09-19T10:00:00.000Z', lastReadAt: '2026-09-19T10:00:00.000Z' },
      'read',
    );

    expect(progress.completed).toBe(true);
    expect(progress.page).toBe(0);
  });

  it('lets the read status decide completion, with the percentage as the fallback', () => {
    const atHundred = { pageNumber: 96, percentage: 100, lastModified: '2026-09-19T10:00:00.000Z', lastReadAt: '2026-09-19T10:00:00.000Z' };

    // Marking a book unread keeps its position, so the status has to win.
    expect(toKomgaReadProgress(atHundred, 'unread').completed).toBe(false);
    expect(toKomgaReadProgress(atHundred, 'reading').completed).toBe(false);
    expect(toKomgaReadProgress(atHundred, 'read').completed).toBe(true);
    expect(toKomgaReadProgress(atHundred, null).completed).toBe(true);
    expect(toKomgaReadProgress({ ...atHundred, percentage: 40 }, null).completed).toBe(false);
  });
});

describe('Komga series mapping', () => {
  it('derives the counters Komga reports', () => {
    const series = toKomgaSeries(seriesSourceFixture());

    expect(series.booksCount).toBe(5);
    expect(series.booksReadCount).toBe(2);
    expect(series.booksInProgressCount).toBe(1);
    expect(series.booksUnreadCount).toBe(2);
    expect(series.metadata.status).toBe('ENDED');
    expect(series.metadata.totalBookCount).toBe(5);
    expect(series.booksMetadata.authors).toEqual([{ name: 'Frank Miller', role: 'writer' }]);
    expect(series.url).toBe('/komga/api/v1/series/91');
  });

  it('reports ONGOING and no total when no provider knows the series size', () => {
    const series = toKomgaSeries(seriesSourceFixture({ expectedBookCount: null, bookCount: 3, readCount: 0, readingCount: 0 }));

    expect(series.metadata.status).toBe('ONGOING');
    expect(series.metadata.totalBookCount).toBeUndefined();
    expect(series.booksUnreadCount).toBe(3);
  });

  it('never reports a negative unread count', () => {
    const series = toKomgaSeries(seriesSourceFixture({ bookCount: 1, readCount: 1, readingCount: 1 }));

    expect(series.booksUnreadCount).toBe(0);
  });
});

describe('Komga library mapping', () => {
  it('reports scanning capability from the allowed formats', () => {
    const library = toKomgaLibrary(librarySourceFixture());

    expect(library.id).toBe('3');
    expect(library.root).toBe('/srv/books/comics');
    expect(library.scanCbx).toBe(true);
    expect(library.scanPdf).toBe(true);
    expect(library.scanEpub).toBe(false);
    expect(library.scanDirectoryExclusions).toEqual(['**/.DS_Store']);
    expect(library.scanInterval).toBe('DAILY');
  });

  it('treats an empty allow-list as scanning everything and no cron as disabled', () => {
    const library = toKomgaLibrary(librarySourceFixture({ allowedFormats: [], autoScanCronExpression: null }));

    expect(library.scanCbx).toBe(true);
    expect(library.scanEpub).toBe(true);
    expect(library.scanInterval).toBe('DISABLED');
  });

  it('defaults the fields the non-superuser listing does not select', () => {
    const library = toKomgaLibrary({ id: 9, name: 'Comics', folders: [] });

    expect(library.root).toBe('');
    expect(library.scanDirectoryExclusions).toEqual([]);
    expect(library.scanEpub).toBe(true);
  });
});

describe('Komga collection and user mapping', () => {
  it('encodes collection and readlist membership as Komga ids', () => {
    expect(toKomgaCollection(collectionSourceFixture()).seriesIds).toEqual(['91', '92']);
    expect(toKomgaCollection(collectionSourceFixture()).ordered).toBe(false);

    const readList = toKomgaReadList(readListSourceFixture());
    expect(readList.bookIds).toEqual(['1287', '1288', '1290']);
    expect(readList.ordered).toBe(true);
    expect(readList.summary).toBe('Read in this order.');
  });

  it('grants roles from what the account can actually do', () => {
    const plain = toKomgaUser(requestUser(), [1], false);
    expect(plain.roles).toEqual(['USER', 'PAGE_STREAMING']);
    expect(plain.sharedAllLibraries).toBe(false);
    expect(plain.sharedLibrariesIds).toEqual(['1']);

    const superuser = toKomgaUser(requestUser({ isSuperuser: true, permissions: [] }), [1, 2], false);
    expect(superuser.roles).toContain('ADMIN');
    expect(superuser.roles).toContain('KOBOSYNC');
    expect(superuser.sharedAllLibraries).toBe(true);

    const downloader = toKomgaUser(requestUser({ permissions: [Permission.LibraryDownload, Permission.KoboSync] }), [], true);
    expect(downloader.roles).toContain('FILE_DOWNLOAD');
    expect(downloader.roles).toContain('KOBOSYNC');
    expect(downloader.email).toBe('');
  });
});

describe('Series index parsing', () => {
  it('parses the free-text series index BookOrbit stores', () => {
    expect(parseSeriesNumber('1')).toBe(1);
    expect(parseSeriesNumber('1.5')).toBe(1.5);
    expect(parseSeriesNumber(null)).toBe(-1);
    expect(parseSeriesNumber('')).toBe(-1);
    expect(parseSeriesNumber('prologue')).toBe(-1);
  });
});
