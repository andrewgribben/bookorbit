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
  "owned",
  "recap_widget",
  "friends_shelf",
  "discover_shelf",
  "trending_shelf",
  "recommendations_shelf",
] as const;
export type ReadingServiceFeature = (typeof READING_SERVICE_FEATURES)[number];

export type ReadingServiceCapabilities = Partial<Record<ReadingServiceFeature, "both" | "push" | "pull" | "read">>;

/**
 * Generic shelves every reading-service provider can expose through
 * `GET /reading-services/:provider/shelves/:shelf`. The provider field on each item is what lets
 * the client render shelves from more than one provider with one component (coordinate with the
 * widgets/web agent before changing field names here).
 */
export const READING_SERVICE_SHELVES = ["friends-reading", "friends-finished", "trending", "recommendations"] as const;
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
};

export type ReadingServiceSummary = {
  provider: ReadingServiceProvider;
  connected: boolean;
  capabilities: ReadingServiceCapabilities;
  features: Partial<Record<ReadingServiceFeature, boolean>>;
  migration: { state: "never" | "running" | "done" | "failed"; runId: number | null; finishedAt: string | null };
  lastPullAt: string | null;
  disabledReason: string | null;
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
