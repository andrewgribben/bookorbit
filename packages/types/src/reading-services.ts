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
] as const;
export type ReadingServiceFeature = (typeof READING_SERVICE_FEATURES)[number];

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
