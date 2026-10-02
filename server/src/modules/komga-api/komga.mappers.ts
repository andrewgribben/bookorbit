import { isComicFormat, Permission, type EpubBookInfo, type EpubTocItem } from '@bookorbit/types';
import type { RequestUser } from '../../common/types/request-user';
import type {
  KomgaApiKey,
  KomgaBook,
  KomgaBookMetadata,
  KomgaCollection,
  KomgaLibrary,
  KomgaMedia,
  KomgaPageEntry,
  KomgaR2Positions,
  KomgaR2Progression,
  KomgaReadList,
  KomgaReadProgress,
  KomgaSeries,
  KomgaUser,
} from './komga-api.types';
import {
  KOMGA_ROLE_ADMIN,
  KOMGA_ROLE_FILE_DOWNLOAD,
  KOMGA_ROLE_KOBOSYNC,
  KOMGA_ROLE_PAGE_STREAMING,
  KOMGA_ROLE_USER,
  KOMGA_URL_PREFIX,
} from './komga-api.constants';
import { encodeKomgaId, parseSeriesNumber, toIso } from './komga-ids';

const EPOCH = new Date(0).toISOString();

export interface KomgaProgressSource {
  pageNumber: number | null;
  percentage: number;
  lastModified: string;
  lastReadAt: string;
}

export interface KomgaBookFileFact {
  id: number;
  format: string | null;
  role: string;
  sizeBytes: number | null;
  fileHash: string | null;
  mtime: string | null;
}

export interface KomgaBookSource {
  id: number;
  libraryId: number;
  status: string;
  title: string | null;
  description: string | null;
  authors: string[];
  genres: string[];
  tags: string[];
  seriesId: number | null;
  seriesName: string | null;
  seriesIndex: string | null;
  primaryFile: KomgaBookFileFact | null;
  pageCount: number | null;
  publishedDate: string | null;
  language: string | null;
  isbn13: string | null;
  publisher: string | null;
  addedAt: string | Date;
  updatedAt: string | Date | null;
  readStatus: string | null;
  progress: KomgaProgressSource | null;
}

export interface KomgaSeriesSource {
  id: number;
  name: string;
  libraryId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastAddedAt: string | null;
  bookCount: number;
  readCount: number;
  readingCount: number;
  expectedBookCount: number | null;
  authors: string[];
}

export interface KomgaLibrarySource {
  id: number;
  name: string;
  folders: { path: string }[];
  allowedFormats?: string[];
  excludePatterns?: string[];
  autoScanCronExpression?: string | null;
}

export interface KomgaCollectionSource {
  id: number;
  name: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  seriesIds: number[];
}

export interface KomgaReadListSource {
  id: number;
  name: string;
  description: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  bookIds: number[];
}

export interface KomgaPageSource {
  name: string;
  sizeBytes?: number | null;
}

const COMIC_MIME_TYPES: Record<string, string> = {
  cbz: 'application/vnd.comicbook+zip',
  cb7: 'application/vnd.comicbook+zip',
  cbx: 'application/vnd.comicbook+zip',
  cbr: 'application/vnd.comicbook-rar',
};

const AUDIO_MIME_TYPES: Record<string, string> = {
  m4b: 'audio/mp4',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  opus: 'audio/opus',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
};

const IMAGE_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
};

export function komgaMediaType(format: string | null | undefined): string {
  const normalized = format?.trim().toLowerCase();
  if (!normalized) return 'application/octet-stream';
  if (COMIC_MIME_TYPES[normalized]) return COMIC_MIME_TYPES[normalized];
  if (AUDIO_MIME_TYPES[normalized]) return AUDIO_MIME_TYPES[normalized];
  if (IMAGE_MIME_TYPES[normalized]) return IMAGE_MIME_TYPES[normalized];
  if (normalized === 'pdf') return 'application/pdf';
  if (normalized === 'epub' || normalized === 'kepub') return 'application/epub+zip';
  return 'application/octet-stream';
}

export function komgaMediaProfile(format: string | null | undefined): string {
  const normalized = format?.trim().toLowerCase();
  if (!normalized) return 'OTHER';
  if (isComicFormat(normalized)) return 'DIVINA';
  if (normalized === 'epub' || normalized === 'kepub') return 'EPUB';
  if (normalized === 'pdf') return 'PDF';
  return 'OTHER';
}

export function komgaMediaStatus(bookStatus: string): string {
  if (bookStatus === 'present') return 'READY';
  if (bookStatus === 'missing') return 'ERROR';
  return 'UNKNOWN';
}

export function toKomgaReadProgress(progress: KomgaProgressSource, readStatus: string | null): KomgaReadProgress {
  const completed = readStatus === null ? progress.percentage >= 100 : readStatus === 'read';
  return {
    completed,
    created: progress.lastModified,
    deviceId: '',
    deviceName: '',
    lastModified: progress.lastModified,
    page: progress.pageNumber ?? 0,
    readDate: progress.lastReadAt,
  };
}

export function toKomgaBook(source: KomgaBookSource): KomgaBook {
  const format = source.primaryFile?.format ?? null;
  const sizeBytes = source.primaryFile?.sizeBytes ?? 0;
  const seriesNumber = parseSeriesNumber(source.seriesIndex);
  const addedAt = toIso(source.addedAt, EPOCH);
  const updatedAt = toIso(source.updatedAt, addedAt);
  const pagesCount = source.pageCount ?? 0;

  const media: KomgaMedia = {
    comment: '',
    epubDivinaCompatible: false,
    epubIsKepub: format?.toLowerCase() === 'kepub',
    mediaProfile: komgaMediaProfile(format),
    mediaType: komgaMediaType(format),
    pagesCount: pagesCount > 0 ? pagesCount : 0,
    status: komgaMediaStatus(source.status),
  };

  const metadata: KomgaBookMetadata = {
    authors: source.authors.map((name) => ({ name, role: 'writer' })),
    authorsLock: false,
    created: addedAt,
    isbn: source.isbn13 ?? '',
    isbnLock: false,
    lastModified: updatedAt,
    links: [],
    linksLock: false,
    number: source.seriesIndex ?? '',
    numberLock: false,
    numberSort: seriesNumber,
    numberSortLock: false,
    ...(source.publishedDate ? { releaseDate: source.publishedDate } : {}),
    releaseDateLock: false,
    summary: source.description ?? '',
    summaryLock: false,
    tags: source.tags,
    tagsLock: false,
    title: source.title ?? `Book ${source.id}`,
    titleLock: false,
  };

  return {
    created: addedAt,
    deleted: source.status === 'missing',
    fileHash: source.primaryFile?.fileHash ?? '',
    fileLastModified: toIso(source.primaryFile?.mtime, updatedAt),
    id: encodeKomgaId(source.id),
    lastModified: updatedAt,
    libraryId: encodeKomgaId(source.libraryId),
    media,
    metadata,
    name: source.title ?? `Book ${source.id}`,
    number: Number.isFinite(seriesNumber) ? Math.trunc(seriesNumber) : -1,
    oneshot: source.seriesId === null,
    ...(source.progress ? { readProgress: toKomgaReadProgress(source.progress, source.readStatus) } : {}),
    seriesId: source.seriesId === null ? '' : encodeKomgaId(source.seriesId),
    seriesTitle: source.seriesName ?? '',
    size: String(sizeBytes),
    sizeBytes,
    url: `${KOMGA_URL_PREFIX}/api/v1/books/${encodeKomgaId(source.id)}`,
  };
}

export function toKomgaSeries(source: KomgaSeriesSource): KomgaSeries {
  const createdAt = toIso(source.createdAt ?? source.lastAddedAt, EPOCH);
  const updatedAt = toIso(source.updatedAt ?? source.lastAddedAt, createdAt);
  const ended = source.expectedBookCount !== null && source.bookCount >= source.expectedBookCount;
  const unread = Math.max(0, source.bookCount - source.readCount - source.readingCount);

  return {
    booksCount: source.bookCount,
    booksInProgressCount: source.readingCount,
    booksMetadata: {
      authors: source.authors.map((name) => ({ name, role: 'writer' })),
      created: createdAt,
      lastModified: updatedAt,
      summary: '',
      summaryNumber: '',
      tags: [],
    },
    booksReadCount: source.readCount,
    booksUnreadCount: unread,
    created: createdAt,
    deleted: false,
    fileLastModified: toIso(source.lastAddedAt, updatedAt),
    id: encodeKomgaId(source.id),
    lastModified: updatedAt,
    libraryId: source.libraryId === null ? '' : encodeKomgaId(source.libraryId),
    metadata: {
      ageRatingLock: false,
      alternateTitles: [],
      alternateTitlesLock: false,
      created: createdAt,
      genres: [],
      genresLock: false,
      // Both are required by the Komga document and neither exists per series in BookOrbit.
      language: '',
      languageLock: false,
      lastModified: updatedAt,
      links: [],
      linksLock: false,
      publisher: '',
      publisherLock: false,
      readingDirection: 'LEFT_TO_RIGHT',
      readingDirectionLock: false,
      sharingLabels: [],
      sharingLabelsLock: false,
      status: ended ? 'ENDED' : 'ONGOING',
      statusLock: false,
      summary: '',
      summaryLock: false,
      tags: [],
      tagsLock: false,
      title: source.name,
      titleLock: false,
      titleSort: source.name,
      titleSortLock: false,
      ...(source.expectedBookCount !== null ? { totalBookCount: source.expectedBookCount } : {}),
      totalBookCountLock: false,
    },
    name: source.name,
    oneshot: false,
    url: `${KOMGA_URL_PREFIX}/api/v1/series/${encodeKomgaId(source.id)}`,
  };
}

export function toKomgaLibrary(source: KomgaLibrarySource): KomgaLibrary {
  const allowed = new Set((source.allowedFormats ?? []).map((format) => format.toLowerCase()));
  const scansAll = allowed.size === 0;
  const scans = (formats: string[]): boolean => scansAll || formats.some((format) => allowed.has(format));
  const hasSchedule = typeof source.autoScanCronExpression === 'string' && source.autoScanCronExpression.trim().length > 0;

  return {
    analyzeDimensions: false,
    convertToCbz: false,
    emptyTrashAfterScan: false,
    hashFiles: true,
    hashKoreader: false,
    hashPages: false,
    id: encodeKomgaId(source.id),
    importBarcodeIsbn: false,
    importComicInfoBook: true,
    importComicInfoCollection: false,
    importComicInfoReadList: false,
    importComicInfoSeries: true,
    importComicInfoSeriesAppendVolume: false,
    importEpubBook: true,
    importEpubSeries: true,
    importLocalArtwork: true,
    importMylarSeries: false,
    name: source.name,
    repairExtensions: false,
    root: source.folders[0]?.path ?? '',
    scanCbx: scans(['cbz', 'cbr', 'cb7', 'cbx']),
    scanDirectoryExclusions: source.excludePatterns ?? [],
    scanEpub: scans(['epub', 'kepub']),
    scanForceModifiedTime: false,
    scanInterval: hasSchedule ? 'DAILY' : 'DISABLED',
    scanOnStartup: false,
    scanPdf: scans(['pdf']),
    seriesCover: 'FIRST',
    unavailable: false,
  };
}

export function toKomgaCollection(source: KomgaCollectionSource): KomgaCollection {
  return {
    createdDate: toIso(source.createdAt, EPOCH),
    filtered: false,
    id: encodeKomgaId(source.id),
    lastModifiedDate: toIso(source.updatedAt, EPOCH),
    name: source.name,
    ordered: false,
    seriesIds: source.seriesIds.map(encodeKomgaId),
  };
}

export function toKomgaReadList(source: KomgaReadListSource): KomgaReadList {
  return {
    bookIds: source.bookIds.map(encodeKomgaId),
    createdDate: toIso(source.createdAt, EPOCH),
    filtered: false,
    id: encodeKomgaId(source.id),
    lastModifiedDate: toIso(source.updatedAt, EPOCH),
    name: source.name,
    ordered: true,
    summary: source.description ?? '',
  };
}

export function toKomgaUser(user: RequestUser, libraryIds: number[], canDownload: boolean): KomgaUser {
  const roles = new Set<string>([KOMGA_ROLE_USER, KOMGA_ROLE_PAGE_STREAMING]);
  if (user.isSuperuser) roles.add(KOMGA_ROLE_ADMIN);
  if (canDownload) roles.add(KOMGA_ROLE_FILE_DOWNLOAD);
  if (user.isSuperuser || user.permissions.includes(Permission.KoboSync)) roles.add(KOMGA_ROLE_KOBOSYNC);

  return {
    email: user.email ?? '',
    id: encodeKomgaId(user.id),
    labelsAllow: [],
    labelsExclude: [],
    roles: [...roles],
    sharedAllLibraries: user.isSuperuser,
    sharedLibrariesIds: libraryIds.map(encodeKomgaId),
  };
}

export function toKomgaPageEntry(source: KomgaPageSource, index: number): KomgaPageEntry {
  const sizeBytes = typeof source.sizeBytes === 'number' && Number.isFinite(source.sizeBytes) ? source.sizeBytes : null;

  return {
    fileName: source.name,
    mediaType: komgaMediaType(source.name.split('.').pop() ?? null),
    number: index + 1,
    size: sizeBytes === null ? '' : String(sizeBytes),
    ...(sizeBytes === null ? {} : { sizeBytes }),
  };
}

export function toKomgaApiKey(id: number, userId: number, label: string, createdAt: string, key: string): KomgaApiKey {
  return {
    comment: label,
    createdDate: toIso(createdAt, EPOCH),
    id: encodeKomgaId(id),
    key,
    lastModifiedDate: toIso(createdAt, EPOCH),
    userId: encodeKomgaId(userId),
  };
}

/** Readium WebPub manifest in Komga's Divina profile. Comic archives have no navigation document. */
export function toKomgaDivinaManifest(source: KomgaBookSource, pages: KomgaPageSource[], bookId: number): Record<string, unknown> {
  const seriesNumber = parseSeriesNumber(source.seriesIndex);

  return {
    // The pinned Komga document names this field `context`; Readium calls it `@context`.
    context: 'https://readium.org/webpub-manifest/context.jsonld',
    metadata: {
      artist: [],
      author: source.authors,
      colorist: [],
      contributor: [],
      editor: [],
      illustrator: [],
      inker: [],
      letterer: [],
      penciler: [],
      publisher: source.publisher ? [source.publisher] : [],
      rendition: { layout: 'pre-paginated', orientation: 'portrait', spread: 'auto', flow: 'paginated' },
      subject: source.genres,
      title: source.title ?? `Book ${bookId}`,
      translator: [],
      ...(source.seriesName
        ? {
            belongsTo: {
              collection: [],
              series: [{ name: source.seriesName, links: [], ...(seriesNumber >= 0 ? { position: seriesNumber } : {}) }],
            },
          }
        : {}),
      ...(source.description ? { description: source.description } : {}),
      ...(source.language ? { language: source.language } : {}),
      numberOfPages: pages.length,
      modified: toIso(source.updatedAt, toIso(source.addedAt, EPOCH)),
    },
    readingOrder: pages.map((page, index) => ({
      href: `${KOMGA_URL_PREFIX}/api/v1/books/${bookId}/pages/${index + 1}`,
      type: komgaMediaType(page.name.split('.').pop() ?? null),
      title: page.name,
      // Readium requires the (usually empty) properties bag on every link.
      properties: {},
    })),
    resources: [],
    links: [],
    toc: [],
    landmarks: [],
    pageList: [],
    images: [],
  };
}

export function toKomgaPositions(pages: KomgaPageSource[], bookId: number): KomgaR2Positions {
  const positions = pages.map((page, index) => ({
    href: `${KOMGA_URL_PREFIX}/api/v1/books/${bookId}/pages/${index + 1}`,
    type: komgaMediaType(page.name.split('.').pop() ?? null),
    title: page.name,
    locations: {
      // Readium requires the fragments bag on every locator; empty means "not a fragment target".
      fragments: [],
      position: index + 1,
      totalProgression: pages.length > 0 ? index / pages.length : 0,
    },
  }));

  return { positions, total: positions.length };
}

/** Komga serves EPUB entries under `/resource/`, and its clients key on that path segment. */
export function komgaResourceHref(bookId: number, entryPath: string): string {
  // A TOC entry can name a fragment (`chapter.xhtml#s2`): the fragment belongs after the encoded
  // path, not inside it, or the client resolves a file that does not exist.
  const hash = entryPath.lastIndexOf('#');
  const path = hash === -1 ? entryPath : entryPath.slice(0, hash);
  const fragment = hash === -1 ? '' : entryPath.slice(hash + 1);

  const encoded = path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${KOMGA_URL_PREFIX}/api/v1/books/${bookId}/resource/${encoded}${fragment ? `#${fragment}` : ''}`;
}

/** Readium WebPub manifest in Komga's EPUB profile, built from the container's own spine. */
export function toKomgaEpubManifest(source: KomgaBookSource, info: EpubBookInfo, bookId: number): Record<string, unknown> {
  const spine = info.spine.filter((item) => item.linear !== false);
  const spinePaths = new Set(info.spine.map((item) => item.href));
  const seriesNumber = parseSeriesNumber(source.seriesIndex);

  // Komga emits the EPUB's own navigation entries, not the synthetic root this module's parser
  // wraps them in, and keeps nesting through `children`.
  const toTocLink = (item: EpubTocItem): Record<string, unknown> => ({
    ...(item.href ? { href: komgaResourceHref(bookId, item.href) } : {}),
    title: item.label,
    properties: {},
    ...(item.children && item.children.length > 0 ? { children: item.children.map(toTocLink) } : {}),
  });

  return {
    context: 'https://readium.org/webpub-manifest/context.jsonld',
    metadata: {
      artist: [],
      author: source.authors,
      colorist: [],
      contributor: [],
      editor: [],
      illustrator: [],
      inker: [],
      letterer: [],
      penciler: [],
      publisher: source.publisher ? [source.publisher] : [],
      rendition: { layout: 'reflowable' },
      subject: source.genres,
      title: source.title ?? `Book ${bookId}`,
      translator: [],
      conformsTo: 'https://readium.org/webpub-manifest/profiles/epub',
      numberOfPages: spine.length,
      modified: toIso(source.updatedAt, toIso(source.addedAt, EPOCH)),
      readingProgression: 'ltr',
      ...(source.language ? { language: source.language } : {}),
      ...(source.description ? { description: source.description } : {}),
      ...(source.isbn13 ? { identifier: `urn:isbn:${source.isbn13}` } : {}),
      ...(source.publishedDate ? { published: source.publishedDate } : {}),
      ...(source.seriesName
        ? {
            belongsTo: {
              collection: [],
              series: [{ name: source.seriesName, links: [], ...(seriesNumber >= 0 ? { position: seriesNumber } : {}) }],
            },
          }
        : {}),
    },
    links: [
      { rel: 'self', href: `${KOMGA_URL_PREFIX}/api/v1/books/${bookId}/manifest/epub`, type: 'application/webpub+json', properties: {} },
      {
        rel: 'acquisition',
        href: `${KOMGA_URL_PREFIX}/api/v1/books/${bookId}/file`,
        type: komgaMediaType(source.primaryFile?.format ?? null),
        properties: {},
      },
    ],
    readingOrder: spine.map((item) => ({ href: komgaResourceHref(bookId, item.href), type: item.mediaType, properties: {} })),
    resources: [
      { href: `${KOMGA_URL_PREFIX}/api/v1/books/${bookId}/thumbnail`, type: 'image/jpeg', properties: {} },
      ...info.manifest
        .filter((item) => !spinePaths.has(item.href))
        .map((item) => ({ href: komgaResourceHref(bookId, item.href), type: item.mediaType, properties: {} })),
    ],
    toc: (info.toc?.children ?? []).map(toTocLink),
    landmarks: [],
    pageList: [],
    images: [],
  };
}

/**
 * Komga's EPUB positions come from analyzed text offsets; BookOrbit does not parse XHTML, so each
 * spine document is one position. Resuming still lands on the right chapter, and the locator
 * shape is the one clients consume.
 */
export function toKomgaEpubPositions(info: EpubBookInfo, bookId: number): KomgaR2Positions {
  const spine = info.spine.filter((item) => item.linear !== false);
  const positions = spine.map((item, index) => ({
    href: komgaResourceHref(bookId, item.href),
    type: item.mediaType,
    locations: {
      fragments: [],
      position: index + 1,
      totalProgression: spine.length > 0 ? index / spine.length : 0,
    },
  }));

  return { positions, total: positions.length };
}

export function toKomgaEpubProgression(source: KomgaBookSource, info: EpubBookInfo, bookId: number): KomgaR2Progression {
  const spine = info.spine.filter((item) => item.linear !== false);
  const percentage = source.progress?.percentage ?? 0;
  const index = spine.length > 0 ? Math.min(spine.length - 1, Math.floor((percentage / 100) * spine.length)) : 0;
  const item = spine[index];

  return {
    device: { id: '', name: '' },
    locator: {
      href: item ? komgaResourceHref(bookId, item.href) : '',
      type: item?.mediaType ?? 'application/xhtml+xml',
      locations: {
        fragments: [],
        position: index + 1,
        totalProgression: percentage / 100,
      },
    },
    modified: source.progress?.lastModified ?? toIso(source.updatedAt, toIso(source.addedAt, EPOCH)),
  };
}

export function toKomgaProgression(source: KomgaBookSource, bookId: number): KomgaR2Progression {
  const page = source.progress?.pageNumber ?? 0;
  const addedAt = toIso(source.addedAt, EPOCH);

  return {
    device: { id: '', name: '' },
    locator: {
      href: `${KOMGA_URL_PREFIX}/api/v1/books/${bookId}/pages/${page}`,
      type: komgaMediaType(source.primaryFile?.format ?? null),
      locations: {
        fragments: [],
        position: page,
        totalProgression: (source.progress?.percentage ?? 0) / 100,
      },
    },
    modified: source.progress?.lastModified ?? toIso(source.updatedAt, addedAt),
  };
}
