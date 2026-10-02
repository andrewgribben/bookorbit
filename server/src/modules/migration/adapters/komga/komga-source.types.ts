import type { SourceExportData } from '../source-adapter.types';

export type KomgaTimestamp = string | number | Date | null;

export interface KomgaUserRecord {
  id: string;
  email: string;
  roles: string[];
}

export interface KomgaAuthorRecord {
  name: string;
  role?: string | null;
}

export interface KomgaReadProgressRecord {
  page?: number | null;
  completed?: boolean | null;
  created?: KomgaTimestamp;
  lastModified?: KomgaTimestamp;
  readDate?: KomgaTimestamp;
}

export interface KomgaBookMediaRecord {
  pagesCount?: number | null;
  mediaType?: string | null;
  mediaProfile?: string | null;
}

export interface KomgaBookMetadataRecord {
  title?: string | null;
  summary?: string | null;
  number?: string | null;
  isbn?: string | null;
  releaseDate?: string | null;
  authors?: KomgaAuthorRecord[] | null;
  tags?: string[] | null;
}

export interface KomgaBookRecord {
  id: string;
  seriesId?: string | null;
  seriesTitle?: string | null;
  number?: number | null;
  name?: string | null;
  url?: string | null;
  fileHash?: string | null;
  libraryId?: string | null;
  deleted?: boolean | null;
  media?: KomgaBookMediaRecord | null;
  metadata?: KomgaBookMetadataRecord | null;
  readProgress?: KomgaReadProgressRecord | null;
}

export interface KomgaSeriesMetadataRecord {
  title?: string | null;
  summary?: string | null;
  publisher?: string | null;
  language?: string | null;
  genres?: string[] | null;
  tags?: string[] | null;
}

export interface KomgaSeriesRecord {
  id: string;
  name?: string | null;
  libraryId?: string | null;
  url?: string | null;
  metadata?: KomgaSeriesMetadataRecord | null;
}

export interface KomgaLibraryRecord {
  id: string;
  name?: string | null;
  root: string;
}

export interface KomgaCollectionRecord {
  id: string;
  name: string;
  seriesIds: string[];
  ordered?: boolean | null;
}

export interface KomgaReadListRecord {
  id: string;
  name: string;
  bookIds: string[];
  ordered?: boolean | null;
}

export interface KomgaSourceRecords {
  sourceVersion: string | null;
  authenticatedUserId: string;
  users: KomgaUserRecord[];
  libraries: KomgaLibraryRecord[];
  series: KomgaSeriesRecord[];
  books: KomgaBookRecord[];
  collections: KomgaCollectionRecord[];
  readLists: KomgaReadListRecord[];
  warnings?: string[];
}

export interface KomgaNormalizationCounters {
  invalidUsersSkipped: number;
  invalidBooksSkipped: number;
  deletedBooksSkipped: number;
  orphanedProgressSkipped: number;
  invalidCollectionsSkipped: number;
  invalidReadListsSkipped: number;
  orphanedShelfBooksSkipped: number;
  shelfNameCollisions: number;
}

export interface KomgaNormalizationResult {
  data: SourceExportData;
  sourceVersion: string | null;
  pathPrefixes: string[];
  warnings: string[];
  counters: KomgaNormalizationCounters;
}
