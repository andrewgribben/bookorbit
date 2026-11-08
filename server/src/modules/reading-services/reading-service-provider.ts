import type {
  Permission,
  ReadingServiceAuthMethod,
  ReadingServiceCapabilities,
  ReadingServiceDeviceAuthPollResult,
  ReadingServiceDeviceAuthStart,
  ReadingServiceProvider,
  ReadingServiceRemoteOnlyBooksPage,
  ReadingServiceShelf,
  ReadingServiceShelfItem,
  SyncRunProgressCounters,
} from '@bookorbit/types';

export interface ReadingServiceProviderAdapter {
  readonly provider: ReadingServiceProvider;
  readonly capabilities: ReadingServiceCapabilities;

  /** Shown in Settings next to Readwise/Hardcover. Private adapters always set this; built-ins leave it undefined. */
  readonly displayName?: string;
  readonly description?: string | null;
  readonly iconUrl?: string | null;

  /**
   * How a user connects this provider. Absent for the two built-ins, which keep their own
   * dedicated settings sections; a private adapter declares at least one method here and the
   * generic reading-service settings UI renders a matching control per entry.
   */
  readonly authMethods?: ReadingServiceAuthMethod[];

  /**
   * The permission that gates every HTTP route for this provider. Built-in providers (Readwise,
   * Hardcover) still go through the controller's fixed `PROVIDER_PERMISSIONS` map for backward
   * compatibility; this field is what lets a private, operator-supplied adapter (registered via
   * `ReadingServicePrivateAdapterLoaderService`) be reached over HTTP at all, since it has no
   * entry in that fixed map. Must be an existing `Permission` enum member - the loader rejects an
   * adapter whose `permission` isn't one, so it can never grant access through a typo or a
   * permission that doesn't exist. Reusing an existing permission such as `Permission.ReadwiseSync`
   * is expected and fine; nothing about this field invents new access control, it only decides
   * which already-existing permission a given adapter's routes require.
   */
  readonly permission: Permission;

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

  /**
   * Paginated list of remote-only books classified from the last completed migration run.
   * Optional because it depends on `finishMigration` having cached a classification; a
   * provider that never ran a migration (or doesn't support one) has nothing to list.
   */
  listRemoteOnlyBooks?(userId: number, offset: number, limit: number): Promise<ReadingServiceRemoteOnlyBooksPage>;

  /**
   * Reads one generic shelf (friends' current/recent reads, trending, recommendations, or
   * Readwise's "owned elsewhere"). Optional because most providers have no social graph; a
   * provider that declares the matching capability in `capabilities` (e.g. `friends_shelf`) must
   * implement this.
   */
  getShelf?(userId: number, shelf: ReadingServiceShelf): Promise<ReadingServiceShelfItem[]>;

  /** Validates a pasted token/credential. Only present when `authMethods` includes a `token` entry. */
  validateCredential?(
    userId: number,
    credential: string,
  ): Promise<{ ok: boolean; accountLabel?: string | null; reason?: 'invalid' | 'expired' | 'network' }>;

  /**
   * Signs in with a username/email + password. Only present when `authMethods` includes a
   * `password` entry. The host passes the raw password straight through and never stores,
   * caches, or logs it beyond this one call - only the returned `credential` is persisted.
   */
  loginWithPassword?(
    userId: number,
    usernameOrEmail: string,
    password: string,
  ): Promise<
    | { ok: true; credential: string; accountLabel?: string | null }
    | { ok: false; reason: 'invalid' | 'mfa_required' | 'network' | 'unsupported'; message?: string | null }
  >;

  /** Starts a device-code sign-in. Only present when `authMethods` includes a `device_code` entry. */
  startDeviceAuth?(userId: number): Promise<ReadingServiceDeviceAuthStart>;

  /** Polls a device-code sign-in started by `startDeviceAuth`; never exposes the raw handle to the client. */
  pollDeviceAuth?(userId: number): Promise<ReadingServiceDeviceAuthPollResult>;

  /** Deletes the stored credential, if any. Private adapters always get this via the loader's bridge. */
  disconnect?(userId: number): Promise<void>;
}
