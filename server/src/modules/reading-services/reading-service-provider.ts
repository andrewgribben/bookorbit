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
}
