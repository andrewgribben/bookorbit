import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import type { ReadingServiceCapabilities, ReadingServiceShelf, ReadingServiceShelfItem, SyncRunProgressCounters } from '@bookorbit/types';

import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceRegistry } from '../reading-services/reading-service-registry.service';
import type { ReadingServiceProviderAdapter } from '../reading-services/reading-service-provider';
import { HardcoverSettingsService } from './hardcover-settings.service';
import { HardcoverSocialService } from './hardcover-social.service';

const SHELF_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h, matching the plan's "cached 6-12h" budget
const SHELF_CACHE_KEY = (shelf: ReadingServiceShelf) => `shelf:${shelf}`;

/**
 * Registers Hardcover with the shared reading-services registry so the generic
 * `GET /reading-services/hardcover/shelves/:shelf` endpoint and the feature-toggle UI can see it.
 *
 * This does NOT replace `HardcoverSyncService`/`HardcoverImportService`, which remain the only
 * code that pushes or pulls a user's own reading state. `migratePage` and `pull` are no-ops here
 * on purpose: the existing module's own scheduler and import flow already cover that, outside
 * the registry's migration/pull machinery, and duplicating it would risk two code paths writing
 * the same Hardcover fields.
 */
@Injectable()
export class HardcoverReadingServicesAdapterService implements ReadingServiceProviderAdapter, OnModuleInit {
  private readonly logger = new Logger(HardcoverReadingServicesAdapterService.name);

  readonly provider = 'hardcover' as const;

  // status/rating/dates mirror HardcoverSettingsService's existing auto-sync toggles
  // (autoSyncOnStatusChange, autoSyncOnRatingChange, autoSyncOnProgressUpdate), which already
  // sync both ways; owned and review are not synced by the existing module, so they are left off.
  readonly capabilities: ReadingServiceCapabilities = {
    status: 'both',
    rating: 'both',
    dates: 'both',
    friends_shelf: 'read',
    trending_shelf: 'read',
    recommendations_shelf: 'read',
  };

  constructor(
    private readonly registry: ReadingServiceRegistry,
    private readonly settingsService: HardcoverSettingsService,
    private readonly socialService: HardcoverSocialService,
    private readonly cache: ReadingServiceCacheService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async isConnected(userId: number): Promise<boolean> {
    return (await this.settingsService.getTokenForUser(userId)) !== null;
  }

  // See the class comment: the existing module owns migration and two-way pull.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  migratePage(_userId: number, _cursor: Record<string, unknown>, _counters: SyncRunProgressCounters): Promise<Record<string, unknown> | null> {
    return Promise.resolve(null);
  }

  /** Refreshes the cached social shelves. Nothing else in the registry calls `pull` today. */
  async pull(userId: number): Promise<void> {
    const token = await this.settingsService.getTokenForUser(userId);
    if (!token) return;

    const shelves: ReadingServiceShelf[] = ['friends-reading', 'friends-finished', 'trending', 'recommendations'];
    for (const shelf of shelves) {
      try {
        const items = await this.socialService.getShelf(userId, token, shelf);
        await this.cache.set(userId, this.provider, SHELF_CACHE_KEY(shelf), items, SHELF_CACHE_TTL_MS);
      } catch (err) {
        this.logger.warn(
          `[hardcover.social_pull] [fail] userId=${userId} shelf=${shelf} error="${err instanceof Error ? err.message : String(err)}" - shelf refresh failed`,
        );
      }
    }
  }

  async getShelf(userId: number, shelf: ReadingServiceShelf): Promise<ReadingServiceShelfItem[]> {
    const cached = await this.cache.get<ReadingServiceShelfItem[]>(userId, this.provider, SHELF_CACHE_KEY(shelf));
    if (cached) return cached;

    const token = await this.settingsService.getTokenForUser(userId);
    if (!token) return [];

    const items = await this.socialService.getShelf(userId, token, shelf);
    await this.cache.set(userId, this.provider, SHELF_CACHE_KEY(shelf), items, SHELF_CACHE_TTL_MS);
    return items;
  }
}
