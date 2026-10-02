export const KOMGA_MOUNT = 'komga';

export const KOMGA_DOCUMENTED_V1 = 'api/v1';
export const KOMGA_DOCUMENTED_V2 = 'api/v2';

/** The mount is excluded from the global `api/v1` prefix, so client-facing URLs start at the root. */
export const KOMGA_URL_PREFIX = `/${KOMGA_MOUNT}`;

export const KOMGA_MAX_PAGE_SIZE = 500;
export const KOMGA_DEFAULT_PAGE_SIZE = 20;

/** Issued with this prefix so a leaked value is recognizable in a log or paste. */
export const KOMGA_API_KEY_PREFIX = 'bko_';
export const KOMGA_API_KEY_BYTES = 32;

/** Komga readlists have no icon; Bookmark is the closest honest fit. */
export const KOMGA_READLIST_ICON = 'Bookmark';

export const KOMGA_ROLE_ADMIN = 'ADMIN';
export const KOMGA_ROLE_USER = 'USER';
export const KOMGA_ROLE_FILE_DOWNLOAD = 'FILE_DOWNLOAD';
export const KOMGA_ROLE_KOBOSYNC = 'KOBOSYNC';
export const KOMGA_ROLE_PAGE_STREAMING = 'PAGE_STREAMING';
