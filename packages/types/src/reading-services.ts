export const READING_SERVICE_PROVIDERS = ["readwise", "hardcover"] as const;
export type ReadingServiceProvider = (typeof READING_SERVICE_PROVIDERS)[number];

export const READING_SERVICE_FEATURES = [
  "status",
  "rating",
  "review",
  "dates",
  "sessions",
  "publish_sessions",
  "highlights",
  "bookmarks",
  "owned",
  "recap_widget",
  "friends_shelf",
  "trending_shelf",
  "recommendations_shelf",
] as const;
export type ReadingServiceFeature = (typeof READING_SERVICE_FEATURES)[number];

/** Features that default to off unless a user has explicitly opted in (everything else is opt-out). */
export const READING_SERVICE_FEATURES_DEFAULT_OFF: ReadonlyArray<ReadingServiceFeature> = ["publish_sessions"];

export type ReadingServiceCapabilities = Partial<Record<ReadingServiceFeature, "both" | "push" | "pull" | "read">>;

/**
 * Generic shelves every reading-service provider can expose through
 * `GET /reading-services/:provider/shelves/:shelf`. The provider field on each item is what lets
 * the client render shelves from more than one provider with one component (coordinate with the
 * widgets/web agent before changing field names here).
 */
export const READING_SERVICE_SHELVES = ["friends-reading", "friends-finished", "trending", "recommendations", "owned-elsewhere"] as const;
export type ReadingServiceShelf = (typeof READING_SERVICE_SHELVES)[number];

export type ReadingServiceShelfFriend = {
  displayName: string;
  avatarUrl: string | null;
  status: string;
  date: string | null;
};

export type ReadingServiceShelfItem = {
  provider: ReadingServiceProvider;
  externalId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  externalUrl: string | null;
  /** The matched BookOrbit book, when one exists locally by ISBN or title+author. */
  bookId: number | null;
  /** Present only on friends shelves. */
  friend: ReadingServiceShelfFriend | null;
  /**
   * Matching hints an adapter may supply when it cannot resolve `bookId` itself (e.g. a private
   * adapter with no local database access). Either an ISBN-10 or ISBN-13, digits only or with
   * standard punctuation; `null`/omitted when the adapter has none. The reading-services
   * controller uses this (and `title`/`authors` as a fallback) to resolve `bookId` server-side
   * against the current user's accessible library before the response reaches the client, then
   * strips both fields - a client never needs to read `isbn`/`asin` itself.
   */
  isbn?: string | null;
  /**
   * Amazon ASIN hint, same purpose as `isbn`. Not currently used for server-side matching: the
   * local book schema has no ASIN column, so this is accepted for forward compatibility only
   * (see docs/AGENT_HANDOFF.md's adapter contract section).
   */
  asin?: string | null;
};

export type ReadingServiceLibrarySetting = {
  libraryId: number;
  enabled: boolean;
  features: Partial<Record<ReadingServiceFeature, boolean>>;
};

/**
 * How a provider wants the user to authenticate. Built-in providers (Readwise, Hardcover) keep
 * their existing dedicated token fields and don't need this; a private adapter declares one or
 * more of these in its `auth.methods` and the generic reading-service settings UI renders the
 * matching control for each.
 */
export type ReadingServiceAuthMethod =
  | { kind: "token"; label: string; help?: string; placeholder?: string }
  | { kind: "device_code"; label: string; help?: string }
  | {
      kind: "password";
      label: string;
      help?: string;
      fields: {
        username: { label: string; placeholder?: string };
        password: { label: string; placeholder?: string };
      };
    };

export type ReadingServiceDeviceAuthStart = {
  verificationUrl: string;
  userCode: string | null;
  expiresAt: string;
  pollIntervalSeconds: number;
};

export type ReadingServiceDeviceAuthPollStatus = "pending" | "approved" | "expired" | "denied" | "error";

export type ReadingServiceDeviceAuthPollResult = {
  status: ReadingServiceDeviceAuthPollStatus;
  accountLabel?: string | null;
  message?: string | null;
};

/** Result of `POST /reading-services/:provider/auth/password`. Never carries the password back. */
export type ReadingServicePasswordLoginResult =
  | { ok: true; accountLabel?: string | null }
  | { ok: false; reason: "invalid" | "mfa_required" | "network" | "unsupported"; message?: string | null };

export type ReadingServiceSummary = {
  provider: ReadingServiceProvider;
  connected: boolean;
  capabilities: ReadingServiceCapabilities;
  features: Partial<Record<ReadingServiceFeature, boolean>>;
  migration: { state: "never" | "running" | "done" | "failed"; runId: number | null; finishedAt: string | null };
  lastPullAt: string | null;
  disabledReason: string | null;
  /**
   * Per-library sync settings for this provider, one entry per library the user can currently
   * access (owner decision). A missing feature key or a missing library entirely means
   * "inherit": the library is enabled and every feature follows `features` above. A library
   * override can only narrow an already-on provider feature, never enable one that's off.
   * Scope gates everything for the provider: push, pull, the initial migration, owned
   * classification and social-shelf local matching. Changing it never deletes anything remote -
   * items already synced for a library that drops out of scope simply stop syncing.
   */
  libraries: ReadingServiceLibrarySetting[];
  /**
   * The following four are only populated for providers that declare them (currently private
   * adapters only; built-ins render through their own existing settings UI and leave these
   * null/empty). They give the generic `ReadingServiceSettings` component everything it needs to
   * render a provider it has never heard of: identity, how to connect, and the current state.
   */
  displayName?: string;
  description?: string | null;
  iconUrl?: string | null;
  authMethods?: ReadingServiceAuthMethod[];
  /** True when a stored credential exists but the provider reported it expired/invalid (`auth_expired`). */
  needsReconnect?: boolean;
};

export type SyncRunProgressCounters = {
  scanned: number;
  matched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
};

export type SyncRunProgress = {
  id: number;
  provider: ReadingServiceProvider;
  kind: "migration" | "pull" | "push";
  status: "running" | "completed" | "failed" | "cancelled";
  counters: SyncRunProgressCounters;
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
};

export type ReadingServiceRemoteOwnership = "owned" | "not_owned" | "unknown";

/** A book that exists on the remote provider but has no match in the local library yet. */
export type ReadingServiceRemoteOnlyBook = {
  externalId: string;
  title: string | null;
  author: string | null;
  coverImageUrl: string | null;
  ownership: ReadingServiceRemoteOwnership;
  externalUrl: string | null;
};

export type ReadingServiceRemoteOnlyBooksPage = {
  items: ReadingServiceRemoteOnlyBook[];
  next: number | null;
  total: number;
};

/** One calendar month's reading time, for the recap widget's month-bars chart. 1-12, January first. */
export interface ReadingRecapMonthData {
  month: number;
  seconds: number;
}

/**
 * Dashboard recap widget (S7). Built from the provider's year stats plus a day-by-day session
 * breakdown, cached server-side. Returned null by the endpoint when the provider isn't connected
 * or the `recap_widget` feature is off; the widget hides entirely rather than rendering empty.
 */
export interface ReadingRecapWidget {
  provider: ReadingServiceProvider;
  year: number;
  booksFinished: number;
  sessions: number;
  totalSeconds: number;
  readingDays: number;
  goal: number | null;
  byMonth: ReadingRecapMonthData[];
}

/** One shelf a connected provider currently exposes, for the "Customize Dashboard" picker. */
export interface ReadingServiceAvailableShelf {
  provider: ReadingServiceProvider;
  shelf: ReadingServiceShelf;
  connected: boolean;
}
