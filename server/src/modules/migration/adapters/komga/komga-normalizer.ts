import { Injectable } from '@nestjs/common';
import { basename } from 'node:path';
import { parseSeriesIndex } from '@bookorbit/types';

import type {
  SourceBook,
  SourceBookFile,
  SourceContributor,
  SourceExportDomains,
  SourceShelf,
  SourceShelfBook,
  SourceUserBookStatus,
  SourceUserFileProgress,
} from '../source-adapter.types';
import type {
  KomgaBookRecord,
  KomgaNormalizationCounters,
  KomgaNormalizationResult,
  KomgaSeriesRecord,
  KomgaSourceRecords,
  KomgaTimestamp,
} from './komga-source.types';

const METADATA_PRESENT_FIELDS = [
  'title',
  'isbn10',
  'isbn13',
  'description',
  'publisher',
  'publishedYear',
  'language',
  'pageCount',
  'seriesName',
  'seriesIndex',
] as const;

type MetadataField = (typeof METADATA_PRESENT_FIELDS)[number];

@Injectable()
export class KomgaNormalizer {
  normalize(records: KomgaSourceRecords): KomgaNormalizationResult {
    const counters = createCounters();
    const warnings = new Set(records.warnings?.map((warning) => warning.trim()).filter(Boolean) ?? []);

    const users = records.users.flatMap((record) => {
      const sourceUserId = normalizeId(record.id);
      const username = normalizeRequiredText(record.email);
      if (!sourceUserId || !username) {
        counters.invalidUsersSkipped++;
        return [];
      }
      return [
        {
          sourceUserId,
          username,
          name: null,
          email: username.includes('@') ? username : null,
        },
      ];
    });
    const sourceUserIds = new Set(users.map((user) => user.sourceUserId));
    const authenticatedUserId = normalizeId(records.authenticatedUserId);
    if (authenticatedUserId && !sourceUserIds.has(authenticatedUserId)) {
      warnings.add('Authenticated Komga user was missing from the exported user list and was skipped for progress import.');
    }

    const seriesById = new Map<string, KomgaSeriesRecord>();
    for (const series of records.series) {
      const id = normalizeId(series.id);
      if (id && !seriesById.has(id)) seriesById.set(id, series);
    }

    const booksBySeriesId = new Map<string, string[]>();
    const books: SourceBook[] = [];
    const bookIds = new Set<string>();

    for (const book of records.books) {
      const normalized = normalizeBook(book, seriesById);
      if (!normalized) {
        if (book.deleted === true) counters.deletedBooksSkipped++;
        else counters.invalidBooksSkipped++;
        continue;
      }
      if (bookIds.has(normalized.sourceBookId)) {
        counters.invalidBooksSkipped++;
        continue;
      }
      bookIds.add(normalized.sourceBookId);
      books.push(normalized);
      const seriesId = normalizeId(book.seriesId);
      if (seriesId) {
        const list = booksBySeriesId.get(seriesId) ?? [];
        list.push(normalized.sourceBookId);
        booksBySeriesId.set(seriesId, list);
      }
    }

    const userBookStatuses: SourceUserBookStatus[] = [];
    const userFileProgress: SourceUserFileProgress[] = [];
    if (authenticatedUserId && sourceUserIds.has(authenticatedUserId)) {
      for (const book of records.books) {
        const sourceBookId = normalizeId(book.id);
        const progress = book.readProgress;
        if (!sourceBookId || !bookIds.has(sourceBookId) || !progress) continue;

        const pagesCount = normalizeNonNegativeNumber(book.media?.pagesCount);
        const page = normalizeNonNegativeNumber(progress.page);
        const completed = progress.completed === true;
        const percentage = completed
          ? 100
          : pagesCount && pagesCount > 0 && page !== null
            ? clampPercentage((page / pagesCount) * 100)
            : page !== null && page > 0
              ? null
              : 0;
        const updatedAt = normalizeTimestamp(progress.lastModified) ?? normalizeTimestamp(progress.readDate) ?? normalizeTimestamp(progress.created);
        const hasProgress = completed || (page !== null && page > 0) || (percentage !== null && percentage > 0);

        if (!hasProgress) continue;

        userBookStatuses.push({
          sourceUserId: authenticatedUserId,
          sourceBookId,
          status: completed ? 'read' : percentage && percentage > 0 ? 'reading' : page !== null && page > 0 ? 'reading' : 'unread',
          percentage: percentage ?? (completed ? 100 : 0),
          startedAt: normalizeTimestamp(progress.created),
          finishedAt: completed ? (normalizeTimestamp(progress.readDate) ?? updatedAt) : null,
          updatedAt,
        });

        userFileProgress.push({
          sourceUserId: authenticatedUserId,
          sourceBookId,
          sourceFileId: `${sourceBookId}:file`,
          percentage: percentage ?? (completed ? 100 : null),
          cfi: null,
          pageNumber: page,
          positionSeconds: null,
          updatedAt,
        });
      }
    } else {
      counters.orphanedProgressSkipped += records.books.filter((book) => book.readProgress).length;
    }

    const { shelves, shelfBooks } = normalizeShelves(records, authenticatedUserId, sourceUserIds, bookIds, booksBySeriesId, counters, warnings);

    const availableDomains: SourceExportDomains = {
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
    };

    appendDiagnosticWarnings(warnings, counters);

    return {
      data: {
        users,
        books,
        userBookStatuses,
        userFileProgress,
        readingSessions: [],
        bookmarks: [],
        annotations: [],
        shelves,
        shelfBooks,
        availableDomains,
      },
      sourceVersion: normalizeNullableText(records.sourceVersion),
      pathPrefixes: normalizePathPrefixes(records.libraries.map((library) => library.root)),
      warnings: [...warnings],
      counters,
    };
  }
}

function normalizeBook(book: KomgaBookRecord, seriesById: Map<string, KomgaSeriesRecord>): SourceBook | null {
  const sourceBookId = normalizeId(book.id);
  if (!sourceBookId || book.deleted === true) return null;

  const seriesId = normalizeId(book.seriesId);
  const series = seriesId ? seriesById.get(seriesId) : null;
  const metadata = book.metadata ?? {};
  const authors = normalizeAuthors(metadata.authors ?? []);
  const { isbn10, isbn13 } = normalizeIsbn(metadata.isbn);
  const seriesName = normalizeNullableText(book.seriesTitle) ?? normalizeNullableText(series?.metadata?.title) ?? normalizeNullableText(series?.name);
  const seriesIndex = normalizeSeriesIndex(metadata.number) ?? normalizeSeriesIndex(book.number);
  const publishedYear = normalizePublishedYear(metadata.releaseDate);
  const pageCount = normalizePositiveInteger(book.media?.pagesCount);
  const genres = normalizeStringList([...(series?.metadata?.genres ?? [])]);
  const tags = normalizeStringList([...(metadata.tags ?? []), ...(series?.metadata?.tags ?? [])]);
  const filePath = normalizeNullableText(book.url);
  const fileName = filePath ? basename(filePath) : null;
  const format = normalizeFormat(fileName);

  const fields = {
    title: normalizeNullableText(metadata.title) ?? normalizeNullableText(book.name),
    isbn10,
    isbn13,
    description: normalizeNullableText(metadata.summary) ?? normalizeNullableText(series?.metadata?.summary),
    publisher: normalizeNullableText(series?.metadata?.publisher),
    publishedYear,
    language: normalizeNullableText(series?.metadata?.language),
    pageCount,
    seriesName,
    seriesIndex,
  } satisfies Record<MetadataField, string | number | null>;

  const presentFields = METADATA_PRESENT_FIELDS.filter((field) => fields[field] !== null);

  const files: SourceBookFile[] = filePath
    ? [
        {
          sourceFileId: `${sourceBookId}:file`,
          sourceBookId,
          filePath,
          fileHash: normalizeNullableText(book.fileHash),
          fileName,
          fileSubPath: fileName,
          durationSeconds: null,
          format,
          sortOrder: 0,
        },
      ]
    : [];

  return {
    sourceBookId,
    ...fields,
    author: authors.length > 0 ? authors.map((author) => author.name).join(', ') : null,
    subtitle: null,
    authors,
    narrators: [],
    filePath,
    fileHash: normalizeNullableText(book.fileHash),
    files,
    genres,
    tags,
    presentFields,
  };
}

function normalizeAuthors(authors: Array<{ name: string; role?: string | null }>): SourceContributor[] {
  const writers = authors.filter((author) => {
    const role = author.role?.trim().toLowerCase() ?? '';
    return role === '' || role === 'writer' || role === 'author';
  });
  const selected = writers.length > 0 ? writers : authors;
  const contributors = selected.flatMap((author, displayOrder) => {
    const name = normalizeRequiredText(author.name);
    if (!name) return [];
    return [{ sourceContributorId: null, name, sortName: null, description: null, displayOrder }];
  });

  const seen = new Set<string>();
  const deduplicated: SourceContributor[] = [];
  for (const contributor of contributors) {
    const key = contributor.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduplicated.push({ ...contributor, displayOrder: deduplicated.length });
  }
  return deduplicated;
}

function normalizeShelves(
  records: KomgaSourceRecords,
  authenticatedUserId: string | null,
  sourceUserIds: Set<string>,
  bookIds: Set<string>,
  booksBySeriesId: Map<string, string[]>,
  counters: KomgaNormalizationCounters,
  warnings: Set<string>,
): { shelves: SourceShelf[]; shelfBooks: SourceShelfBook[] } {
  if (!authenticatedUserId || !sourceUserIds.has(authenticatedUserId)) {
    return { shelves: [], shelfBooks: [] };
  }

  const shelves: SourceShelf[] = [];
  const shelfBooks: SourceShelfBook[] = [];
  const usedNames = new Map<string, string>();

  for (const collection of records.collections) {
    const sourceShelfId = normalizeId(collection.id);
    const baseName = normalizeRequiredText(collection.name);
    if (!sourceShelfId || !baseName) {
      counters.invalidCollectionsSkipped++;
      continue;
    }
    const name = uniqueShelfName(`Collection: ${baseName}`, sourceShelfId, usedNames, counters, warnings);
    shelves.push({ sourceShelfId: `collection:${sourceShelfId}`, sourceUserId: authenticatedUserId, name });

    let position = 0;
    for (const seriesIdRaw of collection.seriesIds) {
      const seriesId = normalizeId(seriesIdRaw);
      const memberBookIds = seriesId ? (booksBySeriesId.get(seriesId) ?? []) : [];
      if (!seriesId || memberBookIds.length === 0) {
        counters.orphanedShelfBooksSkipped++;
        continue;
      }
      for (const sourceBookId of memberBookIds) {
        if (!bookIds.has(sourceBookId)) {
          counters.orphanedShelfBooksSkipped++;
          continue;
        }
        shelfBooks.push({
          sourceShelfId: `collection:${sourceShelfId}`,
          sourceUserId: authenticatedUserId,
          sourceBookId,
          position: position++,
        });
      }
    }
  }

  for (const readList of records.readLists) {
    const sourceShelfId = normalizeId(readList.id);
    const baseName = normalizeRequiredText(readList.name);
    if (!sourceShelfId || !baseName) {
      counters.invalidReadListsSkipped++;
      continue;
    }
    const name = uniqueShelfName(`Read list: ${baseName}`, sourceShelfId, usedNames, counters, warnings);
    shelves.push({ sourceShelfId: `readlist:${sourceShelfId}`, sourceUserId: authenticatedUserId, name });

    let position = 0;
    for (const bookIdRaw of readList.bookIds) {
      const sourceBookId = normalizeId(bookIdRaw);
      if (!sourceBookId || !bookIds.has(sourceBookId)) {
        counters.orphanedShelfBooksSkipped++;
        continue;
      }
      shelfBooks.push({
        sourceShelfId: `readlist:${sourceShelfId}`,
        sourceUserId: authenticatedUserId,
        sourceBookId,
        position: position++,
      });
    }
  }

  return { shelves, shelfBooks };
}

function uniqueShelfName(
  preferred: string,
  sourceShelfId: string,
  usedNames: Map<string, string>,
  counters: KomgaNormalizationCounters,
  warnings: Set<string>,
): string {
  const key = preferred.toLowerCase();
  const existing = usedNames.get(key);
  if (!existing) {
    usedNames.set(key, sourceShelfId);
    return preferred;
  }
  counters.shelfNameCollisions++;
  const disambiguated = `${preferred} (${sourceShelfId})`;
  warnings.add(`Duplicate Komga shelf name "${preferred}" was disambiguated during import.`);
  usedNames.set(disambiguated.toLowerCase(), sourceShelfId);
  return disambiguated;
}

function normalizeIsbn(value: string | null | undefined): { isbn10: string | null; isbn13: string | null } {
  if (!value) return { isbn10: null, isbn13: null };
  const normalized = value.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (/^[0-9]{9}[0-9X]$/.test(normalized)) return { isbn10: normalized, isbn13: null };
  if (/^[0-9]{13}$/.test(normalized)) return { isbn10: null, isbn13: normalized };
  return { isbn10: null, isbn13: null };
}

function normalizePublishedYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isInteger(year) && year >= 1000 && year <= 2200 ? year : null;
}

const normalizeSeriesIndex = (value: string | number | null | undefined): string | null => {
  if (value == null || value === '') return null;
  return parseSeriesIndex(String(value));
};

function normalizeTimestamp(value: KomgaTimestamp | undefined): string | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function normalizeNonNegativeNumber(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return Math.max(0, value);
}

function normalizePositiveInteger(value: number | null | undefined): number | null {
  if (value == null || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

function normalizeFormat(value: string | null | undefined): string | null {
  if (!value) return null;
  const extension = value.includes('.') ? value.slice(value.lastIndexOf('.') + 1) : value;
  const normalized = extension.trim().toLowerCase();
  return normalized || null;
}

function normalizeRequiredText(value: string | null | undefined): string | null {
  return normalizeNullableText(value);
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeId(value: string | number | null | undefined): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return normalizeNullableText(typeof value === 'string' ? value : null);
}

function normalizeStringList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeRequiredText(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function normalizePathPrefixes(paths: string[]): string[] {
  const prefixes = new Set<string>();
  for (const path of paths) {
    const value = normalizeNullableText(path);
    const normalized = value && value !== '/' && !/^[A-Za-z]:[\\/]$/.test(value) ? value.replace(/[\\/]+$/, '') : value;
    if (normalized) prefixes.add(normalized);
  }
  return [...prefixes].sort((left, right) => left.localeCompare(right));
}

function createCounters(): KomgaNormalizationCounters {
  return {
    invalidUsersSkipped: 0,
    invalidBooksSkipped: 0,
    deletedBooksSkipped: 0,
    orphanedProgressSkipped: 0,
    invalidCollectionsSkipped: 0,
    invalidReadListsSkipped: 0,
    orphanedShelfBooksSkipped: 0,
    shelfNameCollisions: 0,
  };
}

function appendDiagnosticWarnings(warnings: Set<string>, counters: KomgaNormalizationCounters): void {
  if (counters.invalidUsersSkipped > 0) warnings.add(`${counters.invalidUsersSkipped} Komga users were skipped because they lacked an id or email.`);
  if (counters.invalidBooksSkipped > 0) warnings.add(`${counters.invalidBooksSkipped} Komga books were skipped because they lacked a usable id.`);
  if (counters.deletedBooksSkipped > 0) warnings.add(`${counters.deletedBooksSkipped} deleted Komga books were skipped.`);
  if (counters.orphanedProgressSkipped > 0) {
    warnings.add(`${counters.orphanedProgressSkipped} Komga progress rows were skipped because the authenticated user was unavailable.`);
  }
  if (counters.invalidCollectionsSkipped > 0) warnings.add(`${counters.invalidCollectionsSkipped} Komga collections were skipped.`);
  if (counters.invalidReadListsSkipped > 0) warnings.add(`${counters.invalidReadListsSkipped} Komga read lists were skipped.`);
  if (counters.orphanedShelfBooksSkipped > 0) {
    warnings.add(`${counters.orphanedShelfBooksSkipped} Komga collection or read-list memberships referenced missing books.`);
  }
}
