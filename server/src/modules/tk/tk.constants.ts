export const TK_BASE_URL = 'https://tk.xyz';
export const TK_MCP_URL = `${TK_BASE_URL}/mcp`;
export const TK_MCP_PROTOCOL_VERSION = '2025-06-18';
export const TK_OAUTH_REGISTER_URL = `${TK_BASE_URL}/oauth/register`;
export const TK_OAUTH_AUTHORIZE_URL = `${TK_BASE_URL}/oauth/authorize`;
export const TK_OAUTH_TOKEN_URL = `${TK_BASE_URL}/oauth/token`;
export const TK_OAUTH_SCOPE = 'read write';
export const TK_OAUTH_PORT = 53682;
export const TK_OAUTH_REDIRECT_URI = `http://127.0.0.1:${TK_OAUTH_PORT}/callback`;
export const TK_USER_AGENT = 'bookorbit-tk-sync/1.0';

// TK publishes no rate limit; serialise calls per user with a small minimum interval, as Readwise does.
export const TK_MIN_INTERVAL_MS = 300;
export const TK_REQUEST_TIMEOUT_MS = 15_000;

export const TK_AUTO_SYNC_DEBOUNCE_MS = 1000;
export const TK_AUTO_SYNC_MAX_WAIT_MS = 5000;
export const TK_AUTO_SYNC_RETRY_BASE_MS = 30_000;
export const TK_AUTO_SYNC_MAX_RETRIES = 5;

export const TK_PENDING_OAUTH_TTL_MS = 10 * 60_000;

export const TK_SECTION_HEADING = 'BookOrbit';
export const TK_ITEM_MAX_CHARS = 8000;

export const TK_TAGS = ['bookorbit'];

// How many pending items to collect per kind, per flush; keeps one flush bounded.
export const TK_FLUSH_PAGE_SIZE = 500;

export function bookOrbitTkBookUrl(appUrl: string, bookId: number): string {
  return `${appUrl.replace(/\/+$/, '')}/book/${bookId}`;
}

export function bookOrbitTkAnnotationUrl(appUrl: string, bookId: number, annotationId: number): string {
  return `${appUrl.replace(/\/+$/, '')}/book/${bookId}?tab=highlights&annotationId=${annotationId}`;
}
