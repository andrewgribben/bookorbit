import type { EpubBookInfo } from '@bookorbit/types';

import type {
  KomgaCollectionSource,
  KomgaLibrarySource,
  KomgaBookSource,
  KomgaPageSource,
  KomgaReadListSource,
  KomgaSeriesSource,
} from './komga.mappers';

export function bookSourceFixture(overrides: Partial<KomgaBookSource> = {}): KomgaBookSource {
  return {
    id: 1287,
    libraryId: 3,
    status: 'present',
    title: 'Batman: Year One',
    description: "A retelling of Batman's first year.",
    authors: ['Frank Miller', 'David Mazzucchelli'],
    genres: ['Superhero'],
    tags: ['batman', 'dc'],
    seriesId: 91,
    seriesName: 'Batman',
    seriesIndex: '1',
    primaryFile: {
      id: 5501,
      format: 'cbz',
      role: 'primary',
      sizeBytes: 51380224,
      fileHash: '9f2c4e1a5b7d3c8e9f0a1b2c3d4e5f60',
      mtime: '2026-09-18T18:03:00.000Z',
    },
    pageCount: 96,
    publishedDate: '1987-02-01',
    language: 'en',
    isbn13: '9781401207526',
    publisher: 'DC Comics',
    addedAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-18T18:03:00.000Z',
    readStatus: null,
    progress: null,
    ...overrides,
  };
}

export function seriesSourceFixture(overrides: Partial<KomgaSeriesSource> = {}): KomgaSeriesSource {
  return {
    id: 91,
    name: 'Batman',
    libraryId: 3,
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-18T18:03:00.000Z',
    lastAddedAt: '2026-09-18T18:03:00.000Z',
    bookCount: 5,
    readCount: 2,
    readingCount: 1,
    expectedBookCount: 5,
    authors: ['Frank Miller'],
    ...overrides,
  };
}

export function librarySourceFixture(overrides: Partial<KomgaLibrarySource> = {}): KomgaLibrarySource {
  return {
    id: 3,
    name: 'Comics',
    folders: [{ path: '/srv/books/comics' }],
    allowedFormats: ['cbz', 'cbr', 'pdf'],
    excludePatterns: ['**/.DS_Store'],
    autoScanCronExpression: '0 3 * * *',
    ...overrides,
  };
}

export function collectionSourceFixture(overrides: Partial<KomgaCollectionSource> = {}): KomgaCollectionSource {
  return {
    id: 12,
    name: 'Batman shelf',
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-03T09:00:00.000Z',
    seriesIds: [91, 92],
    ...overrides,
  };
}

export function readListSourceFixture(overrides: Partial<KomgaReadListSource> = {}): KomgaReadListSource {
  return {
    id: 44,
    name: 'Crisis reading order',
    description: 'Read in this order.',
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-04T09:00:00.000Z',
    bookIds: [1287, 1288, 1290],
    ...overrides,
  };
}

export function pageEntryFixture(overrides: Partial<KomgaPageSource> = {}): KomgaPageSource {
  return { name: 'pages/001.png', ...overrides };
}

export function pageEntriesFixture(count: number): KomgaPageSource[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `pages/${String(index + 1).padStart(3, '0')}.png`,
    sizeBytes: 400_000 + index,
  }));
}

/** Two spine documents plus the assets an EPUB container always carries. */
export function epubInfoFixture(): EpubBookInfo {
  return {
    containerPath: 'OPS/content.opf',
    rootPath: 'OPS/',
    spine: [
      { idref: 'chapter1', href: 'OPS/chapter1.xhtml', mediaType: 'application/xhtml+xml', linear: true },
      { idref: 'chapter2', href: 'OPS/chapter2.xhtml', mediaType: 'application/xhtml+xml', linear: true },
    ],
    manifest: [
      { id: 'chapter1', href: 'OPS/chapter1.xhtml', mediaType: 'application/xhtml+xml', size: 1024 },
      { id: 'chapter2', href: 'OPS/chapter2.xhtml', mediaType: 'application/xhtml+xml', size: 2048 },
      { id: 'style', href: 'OPS/style.css', mediaType: 'text/css', size: 128 },
      { id: 'cover', href: 'OPS/cover.jpg', mediaType: 'image/jpeg', size: 4096, properties: ['cover-image'] },
    ],
    toc: { label: 'Table of Contents', children: [{ label: 'Chapter 1', href: 'OPS/chapter1.xhtml#s2' }] },
    metadata: { title: 'The Da Vinci Code', language: 'en' },
    coverPath: 'OPS/cover.jpg',
  };
}
