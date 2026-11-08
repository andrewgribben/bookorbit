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
  "discover_shelf",
] as const;
export type ReadingServiceFeature = (typeof READING_SERVICE_FEATURES)[number];

/** Features that default to off unless a user has explicitly opted in (everything else is opt-out). */
export const READING_SERVICE_FEATURES_DEFAULT_OFF: ReadonlyArray<ReadingServiceFeature> = ["publish_sessions"];

export type ReadingServiceCapabilities = Partial<Record<ReadingServiceFeature, "both" | "push" | "pull" | "read">>;

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
