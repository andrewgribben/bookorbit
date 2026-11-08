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

/**
 * A book the user owns on an external reading service but that the service alone can tell us
 * about, generic across providers so a future Hardcover/friends shelf can reuse the shape (plan
 * §7.2). `libraryBookId` is set only when a BookOrbit book was independently matched (by ISBN or
 * normalized title+author); it is not implied by `provider`/`providerUrl` both being present.
 */
export interface ExternalBookCard {
  title: string;
  author: string | null;
  coverUrl: string | null;
  isbn13: string | null;
  provider: ReadingServiceProvider;
  providerUrl: string | null;
  libraryBookId: number | null;
  people: string[];
}
