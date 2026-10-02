export interface KomgaAuthor {
  name: string;
  role: string;
}

export interface KomgaWebLink {
  label: string;
  url: string;
}

export interface KomgaReadProgress {
  completed: boolean;
  created: string;
  deviceId: string;
  deviceName: string;
  lastModified: string;
  page: number;
  readDate: string;
}

export interface KomgaMedia {
  comment: string;
  epubDivinaCompatible: boolean;
  epubIsKepub: boolean;
  mediaProfile: string;
  mediaType: string;
  pagesCount: number;
  status: string;
}

export interface KomgaBookMetadata {
  authors: KomgaAuthor[];
  authorsLock: boolean;
  created: string;
  isbn: string;
  isbnLock: boolean;
  lastModified: string;
  links: KomgaWebLink[];
  linksLock: boolean;
  number: string;
  numberLock: boolean;
  numberSort: number;
  numberSortLock: boolean;
  releaseDate?: string;
  releaseDateLock: boolean;
  summary: string;
  summaryLock: boolean;
  tags: string[];
  tagsLock: boolean;
  title: string;
  titleLock: boolean;
}

export interface KomgaBook {
  created: string;
  deleted: boolean;
  fileHash: string;
  fileLastModified: string;
  id: string;
  lastModified: string;
  libraryId: string;
  media: KomgaMedia;
  metadata: KomgaBookMetadata;
  name: string;
  number: number;
  oneshot: boolean;
  readProgress?: KomgaReadProgress;
  seriesId: string;
  seriesTitle: string;
  size: string;
  sizeBytes: number;
  url: string;
}

export interface KomgaBookMetadataAggregation {
  authors: KomgaAuthor[];
  created: string;
  lastModified: string;
  releaseDate?: string;
  summary: string;
  summaryNumber: string;
  tags: string[];
}

export interface KomgaSeriesMetadata {
  ageRating?: number;
  ageRatingLock: boolean;
  alternateTitles: { label: string; title: string }[];
  alternateTitlesLock: boolean;
  created: string;
  genres: string[];
  genresLock: boolean;
  language?: string;
  languageLock: boolean;
  lastModified: string;
  links: KomgaWebLink[];
  linksLock: boolean;
  publisher?: string;
  publisherLock: boolean;
  readingDirection: string;
  readingDirectionLock: boolean;
  sharingLabels: string[];
  sharingLabelsLock: boolean;
  status: string;
  statusLock: boolean;
  summary: string;
  summaryLock: boolean;
  tags: string[];
  tagsLock: boolean;
  title: string;
  titleLock: boolean;
  titleSort: string;
  titleSortLock: boolean;
  totalBookCount?: number;
  totalBookCountLock: boolean;
}

export interface KomgaSeries {
  booksCount: number;
  booksInProgressCount: number;
  booksMetadata: KomgaBookMetadataAggregation;
  booksReadCount: number;
  booksUnreadCount: number;
  created: string;
  deleted: boolean;
  fileLastModified: string;
  id: string;
  lastModified: string;
  libraryId: string;
  metadata: KomgaSeriesMetadata;
  name: string;
  oneshot: boolean;
  url: string;
}

export interface KomgaLibrary {
  analyzeDimensions: boolean;
  convertToCbz: boolean;
  emptyTrashAfterScan: boolean;
  hashFiles: boolean;
  hashKoreader: boolean;
  hashPages: boolean;
  id: string;
  importBarcodeIsbn: boolean;
  importComicInfoBook: boolean;
  importComicInfoCollection: boolean;
  importComicInfoReadList: boolean;
  importComicInfoSeries: boolean;
  importComicInfoSeriesAppendVolume: boolean;
  importEpubBook: boolean;
  importEpubSeries: boolean;
  importLocalArtwork: boolean;
  importMylarSeries: boolean;
  name: string;
  oneshotsDirectory?: string;
  repairExtensions: boolean;
  root: string;
  scanCbx: boolean;
  scanDirectoryExclusions: string[];
  scanEpub: boolean;
  scanForceModifiedTime: boolean;
  scanInterval: string;
  scanOnStartup: boolean;
  scanPdf: boolean;
  seriesCover: string;
  unavailable: boolean;
}

export interface KomgaCollection {
  createdDate: string;
  filtered: boolean;
  id: string;
  lastModifiedDate: string;
  name: string;
  ordered: boolean;
  seriesIds: string[];
}

export interface KomgaReadList {
  bookIds: string[];
  createdDate: string;
  filtered: boolean;
  id: string;
  lastModifiedDate: string;
  name: string;
  ordered: boolean;
  summary: string;
}

export interface KomgaUser {
  ageRestriction?: { age: number; restriction: string };
  email: string;
  id: string;
  labelsAllow: string[];
  labelsExclude: string[];
  roles: string[];
  sharedAllLibraries: boolean;
  sharedLibrariesIds: string[];
}

export interface KomgaApiKey {
  comment: string;
  createdDate: string;
  id: string;
  key: string;
  lastModifiedDate: string;
  userId: string;
}

export interface KomgaPageEntry {
  fileName: string;
  height?: number;
  mediaType: string;
  number: number;
  size: string;
  sizeBytes?: number;
  width?: number;
}

export interface KomgaPage<T> {
  content: T[];
  empty: boolean;
  first: boolean;
  last: boolean;
  number: number;
  numberOfElements: number;
  pageable: {
    offset: number;
    pageNumber: number;
    pageSize: number;
    paged: boolean;
    sort: { empty: boolean; sorted: boolean; unsorted: boolean };
    unpaged: boolean;
  };
  size: number;
  sort: { empty: boolean; sorted: boolean; unsorted: boolean };
  totalElements: number;
  totalPages: number;
}

export interface KomgaR2Progression {
  device: { id: string; name: string };
  locator: {
    href: string;
    type: string;
    title?: string;
    locations?: { fragments?: string[]; position?: number; progression?: number; totalProgression?: number };
  };
  modified: string;
}

export interface KomgaR2Positions {
  positions: KomgaR2Progression['locator'][];
  total: number;
}
