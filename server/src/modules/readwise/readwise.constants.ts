export const READWISE_BASE_URL = 'https://readwise.io/api/v2';
export const READWISE_HIGHLIGHTS_URL = `${READWISE_BASE_URL}/highlights/`;
export const READWISE_AUTH_URL = `${READWISE_BASE_URL}/auth/`;
export const READWISE_EXPORT_URL = `${READWISE_BASE_URL}/export/`;
export function readwiseHighlightDetailUrl(externalId: string): string {
  return `${READWISE_BASE_URL}/highlights/${externalId}/`;
}

// Rate limit is 240 req/min for highlights CREATE → ~250ms between requests, keep margin.
export const READWISE_MIN_INTERVAL_MS = 300;
export const READWISE_MAX_RETRIES = 3;
export const READWISE_AUTO_SYNC_DEBOUNCE_MS = 1000;
export const READWISE_AUTO_SYNC_MAX_WAIT_MS = 5000;
export const READWISE_AUTO_SYNC_RETRY_BASE_MS = 30_000;
export const READWISE_AUTO_SYNC_MAX_RETRIES = 5;
export const READWISE_REQUEST_TIMEOUT_MS = 15_000;

// Readwise field length caps (from readwise.io/api_deets).
export const READWISE_MAX = {
  TEXT: 8191,
  TITLE: 511,
  AUTHOR: 1024,
  NOTE: 8191,
  HIGHLIGHT_URL: 4095,
} as const;

export const READWISE_SOURCE_TYPE = 'bookorbit';
export const READWISE_CATEGORY = 'books';

export function bookOrbitReadwiseHighlightUrl(appUrl: string, bookId: number, annotationId: number): string {
  return `${appUrl.replace(/\/+$/, '')}/book/${bookId}?tab=highlights&annotationId=${annotationId}`;
}

// Public cover URL by ISBN. `?default=false` makes OpenLibrary return 404 for a
// missing cover (Readwise then stores no image) instead of a blank placeholder pixel.
export const OPENLIBRARY_COVER_BASE = 'https://covers.openlibrary.org/b/isbn';
export function openLibraryCoverUrl(isbn: string): string {
  return `${OPENLIBRARY_COVER_BASE}/${isbn}-L.jpg?default=false`;
}

// How many highlights to send per POST (Readwise accepts large batches; keep bounded).
export const READWISE_BATCH_SIZE = 100;

// Readwise Books API (shelves, ratings, sessions, stats). Separate experimental v1 surface,
// distinct from the highlights v2 API above.
export const READWISE_BOOKS_BASE_URL = 'https://readwise.io/books/api/v1';
export const READWISE_BOOKS_URL = `${READWISE_BOOKS_BASE_URL}/books`;
export const READWISE_SESSIONS_URL = `${READWISE_BOOKS_BASE_URL}/sessions`;
export const READWISE_STATS_SUMMARY_URL = `${READWISE_BOOKS_BASE_URL}/stats/summary`;
export const READWISE_SESSIONS_BY_DAY_URL = `${READWISE_BOOKS_BASE_URL}/stats/sessions-by-day`;

// Batch and page sizes from the Books API docs (readwise.io/books_api).
export const READWISE_BOOKS_LIST_LIMIT = 1000;
export const READWISE_BOOKS_ISBN_BATCH = 100;
export const READWISE_BOOKS_CREATE_BATCH = 10;
export const READWISE_BOOKS_UPDATE_BATCH = 100;
export const READWISE_SESSIONS_CREATE_BATCH = 10;

// How many local books the migration push phase handles per run page.
export const READWISE_MIGRATION_PUSH_PAGE_SIZE = 200;

// S3 two-way books sync: event-driven push debounce (mirrors READWISE_AUTO_SYNC_* above, kept
// separate because it carries per-user pending book ids rather than a single flush flag).
export const READWISE_BOOKS_PUSH_DEBOUNCE_MS = 2000;
export const READWISE_BOOKS_PUSH_MAX_WAIT_MS = 10_000;
export const READWISE_BOOKS_PUSH_RETRY_BASE_MS = 30_000;
export const READWISE_BOOKS_PUSH_MAX_RETRIES = 5;

// S3 interval pull: incremental poll cadence, and how often a full re-list runs to catch
// rating/review changes that don't bump Readwise's `updated` field (readwise-api.md §3).
export const READWISE_BOOKS_PULL_INTERVAL_MS = 15 * 60_000;
export const READWISE_BOOKS_FULL_PASS_INTERVAL_MS = 6 * 60 * 60_000;
export const READWISE_BOOKS_PULL_USER_CONCURRENCY = 2;
export const READWISE_BOOKS_PULL_CURSOR_CACHE_KEY = 'books-pull-cursor';
// The cursor cache entry has no natural expiry; set a far-future TTL so `ReadingServiceCacheService` keeps it.
export const READWISE_BOOKS_PULL_CURSOR_TTL_MS = 365 * 24 * 60 * 60_000;

// S4 sessions: push every unlinked, non-readwise local session for the changed books, debounced
// the same way as the S3 books push. Pull reuses the books pull cadence (same @Interval period).
export const READWISE_SESSIONS_PUSH_DEBOUNCE_MS = 2000;
export const READWISE_SESSIONS_PUSH_MAX_WAIT_MS = 10_000;
export const READWISE_SESSIONS_PUSH_RETRY_BASE_MS = 30_000;
export const READWISE_SESSIONS_PUSH_MAX_RETRIES = 5;
// Only push a session once it has been read for at least this long (plan §"S4 tasks", step 1).
export const READWISE_SESSIONS_MIN_PUSH_DURATION_SECONDS = 60;
// How many unlinked local sessions to look at per book per flush; keeps one flush bounded even
// after a long period offline from Readwise.
export const READWISE_SESSIONS_PUSH_PAGE_SIZE = 200;

export const READWISE_SESSIONS_PULL_INTERVAL_MS = READWISE_BOOKS_PULL_INTERVAL_MS;
export const READWISE_SESSIONS_PULL_USER_CONCURRENCY = READWISE_BOOKS_PULL_USER_CONCURRENCY;
export const READWISE_SESSIONS_PULL_CURSOR_CACHE_KEY = 'sessions-pull-cursor';
export const READWISE_SESSIONS_PULL_CURSOR_TTL_MS = READWISE_BOOKS_PULL_CURSOR_TTL_MS;

// Reconnect-safe first-connect reconcile (see readwise-sessions-reconcile.service.ts): how close
// a local session's start time and duration need to be to a remote one to count as the same
// session, and the cache key/TTL gating the one-time reconcile pass per user.
export const READWISE_SESSIONS_RECONCILE_TOLERANCE_SECONDS = 60;
export const READWISE_SESSIONS_RECONCILED_CACHE_KEY = 'sessions-reconciled';
export const READWISE_SESSIONS_RECONCILED_TTL_MS = READWISE_BOOKS_PULL_CURSOR_TTL_MS;

// S5 highlights two-way: create/update/delete push is folded into the existing
// ReadwiseSyncService.flush() debounce (READWISE_AUTO_SYNC_* above), triggered now by
// annotation.created/updated/deleted. Pull runs on the same interval cadence as books/sessions.
export const READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE = 100;
export const READWISE_HIGHLIGHTS_PULL_INTERVAL_MS = READWISE_BOOKS_PULL_INTERVAL_MS;
export const READWISE_HIGHLIGHTS_PULL_USER_CONCURRENCY = READWISE_BOOKS_PULL_USER_CONCURRENCY;
export const READWISE_HIGHLIGHTS_PULL_CURSOR_CACHE_KEY = 'highlights-pull-cursor';
export const READWISE_HIGHLIGHTS_PULL_CURSOR_TTL_MS = READWISE_BOOKS_PULL_CURSOR_TTL_MS;
export const READWISE_HIGHLIGHTS_LEDGER_BACKFILLED_CACHE_KEY = 'highlights-ledger-backfilled';
// The flag never expires once set; a far-future TTL keeps `ReadingServiceCacheService.get` happy.
export const READWISE_HIGHLIGHTS_LEDGER_BACKFILLED_TTL_MS = READWISE_BOOKS_PULL_CURSOR_TTL_MS;
// Export is grouped by book, so a page can hold many highlights; keep the HTTP page bounded.
export const READWISE_HIGHLIGHTS_EXPORT_PAGE_SIZE = 1000;

// S7 dashboard recap widget: cache key and TTL (plan §5.5/§7, "sensible TTL e.g. 1h").
export const READWISE_RECAP_CACHE_KEY_PREFIX = 'recap';
export const READWISE_RECAP_CACHE_TTL_MS = 60 * 60_000;

// S7 "Owned elsewhere" shelf: Readwise-only books classified as owned (readwise-book-ownership.ts),
// excluding anything already linked to a BookOrbit book. Cached longer than the recap widget
// since it needs a full remote-library page plus a full local-library page to build.
export const READWISE_OWNED_ELSEWHERE_CACHE_KEY = 'owned-elsewhere';
export const READWISE_OWNED_ELSEWHERE_CACHE_TTL_MS = 6 * 60 * 60_000;
export const READWISE_OWNED_ELSEWHERE_LOCAL_PAGE_SIZE = 500;
