import type { ReadingServiceCapabilities, ReadingServiceProvider, SyncRunProgressCounters } from '@bookorbit/types';

export interface ReadingServiceProviderAdapter {
  readonly provider: ReadingServiceProvider;
  readonly capabilities: ReadingServiceCapabilities;

  isConnected(userId: number): Promise<boolean>;

  /**
   * One page of the migration: match, then create or update, return the next cursor or null
   * when the migration is done.
   */
  migratePage(userId: number, cursor: Record<string, unknown>, counters: SyncRunProgressCounters): Promise<Record<string, unknown> | null>;

  /** Incremental pull since the stored cursor. */
  pull(userId: number): Promise<void>;

  /**
   * Read-only dry run used by the migration preview screen: how many local books already have a
   * remote match, how many would be created, and how many remote-only books would not be
   * touched. Optional because not every stage of every provider implements it yet.
   */
  previewMigration?(userId: number): Promise<{ matched: number; toCreate: number; readwiseOnly: number }>;
}
