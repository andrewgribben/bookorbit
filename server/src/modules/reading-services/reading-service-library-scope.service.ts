import { Injectable } from '@nestjs/common';

import type { ReadingServiceFeature, ReadingServiceLibrarySetting, ReadingServiceProvider } from '@bookorbit/types';
import { READING_SERVICE_FEATURES } from '@bookorbit/types';

import type { RequestUser } from '../../common/types/request-user';
import { LibraryService } from '../library/library.service';
import { DEFAULT_LIBRARY_SETTING, effectiveLibraryIdsForFeature, type EffectiveLibrarySetting } from './library-scope.utils';
import { ReadingServicesRepository } from './reading-services.repository';

/**
 * Per-user, per-provider, per-library sync settings (owner decision: scoping is per library AND
 * per feature, not just a library allow-list). Stored once per `(userId, provider, libraryId)`
 * so Readwise, Hardcover and future providers (StoryGraph etc) share one implementation. A
 * missing row means "inherit": library enabled, every feature follows the provider toggle.
 */
@Injectable()
export class ReadingServiceLibraryScopeService {
  constructor(
    private readonly repo: ReadingServicesRepository,
    private readonly libraryService: LibraryService,
  ) {}

  /** Accessible library ids where `feature` is effectively usable; `null` feature checks `enabled` only. */
  async getEffectiveLibraryIds(user: RequestUser, provider: ReadingServiceProvider, feature: ReadingServiceFeature | null): Promise<number[]> {
    const [accessible, settings] = await Promise.all([this.libraryService.findAccessibleLibraryIds(user), this.getSettingsMap(user, provider)]);
    return effectiveLibraryIdsForFeature(accessible, settings, feature);
  }

  /**
   * For background work that only has a user id. Superusers get every library without access rows,
   * so a stand-in user that is never a superuser would see no libraries at all.
   */
  async getEffectiveLibraryIdsForUserId(userId: number, provider: ReadingServiceProvider, feature: ReadingServiceFeature | null): Promise<number[]> {
    const isSuperuser = await this.repo.isSuperuser(userId);
    return this.getEffectiveLibraryIds({ id: userId, isSuperuser } as RequestUser, provider, feature);
  }

  /** Raw settings map keyed by library id, dropping ids the user has since lost access to. */
  private async getSettingsMap(user: RequestUser, provider: ReadingServiceProvider): Promise<Map<number, EffectiveLibrarySetting>> {
    const accessible = new Set(await this.libraryService.findAccessibleLibraryIds(user));
    const rows = await this.repo.findLibrarySettings(user.id, provider);
    const map = new Map<number, EffectiveLibrarySetting>();
    for (const row of rows) {
      if (!accessible.has(row.libraryId)) continue;
      map.set(row.libraryId, { enabled: row.enabled, features: row.features ?? {}, seriesMode: row.seriesMode });
    }
    return map;
  }

  /**
   * One entry per accessible library with its effective settings (inherited default when no row
   * exists), for `GET /reading-services` - documented choice: the API always lists every library
   * the user can access, not just the ones that differ, so the client never has to merge with a
   * separate library list to render "inherits".
   */
  async getLibrarySummaries(user: RequestUser, provider: ReadingServiceProvider): Promise<ReadingServiceLibrarySetting[]> {
    const accessible = await this.libraryService.findAccessibleLibraryIds(user);
    const settings = await this.getSettingsMap(user, provider);
    return accessible.map((libraryId) => {
      const setting = settings.get(libraryId) ?? DEFAULT_LIBRARY_SETTING;
      return {
        libraryId,
        enabled: setting.enabled,
        features: setting.features as Partial<Record<ReadingServiceFeature, boolean>>,
        seriesMode: setting.seriesMode,
      };
    });
  }

  /**
   * Validates access and feature keys, then upserts the override. Unknown feature keys are
   * dropped rather than rejected, so a forward-compatible client sending a feature this server
   * version doesn't know yet degrades instead of erroring the whole request.
   */
  async setLibrarySetting(
    user: RequestUser,
    provider: ReadingServiceProvider,
    libraryId: number,
    input: { enabled?: boolean; features?: Partial<Record<string, boolean>>; seriesMode?: boolean },
  ): Promise<ReadingServiceLibrarySetting> {
    const accessible = new Set(await this.libraryService.findAccessibleLibraryIds(user));
    if (!accessible.has(libraryId)) {
      throw new Error(`Library ${libraryId} is not accessible to user ${user.id}`);
    }

    const known = new Set<string>(READING_SERVICE_FEATURES);
    const sanitizedFeatures: Partial<Record<string, boolean>> = {};
    if (input.features) {
      for (const [key, value] of Object.entries(input.features)) {
        if (known.has(key) && typeof value === 'boolean') sanitizedFeatures[key] = value;
      }
    }

    const current = (await this.getSettingsMap(user, provider)).get(libraryId) ?? DEFAULT_LIBRARY_SETTING;
    const enabled = input.enabled ?? current.enabled;
    const features = { ...current.features, ...sanitizedFeatures };
    // Comic series mode is Readwise-only (owner decision); any value sent for another provider is ignored.
    const seriesMode = provider === 'readwise' ? (input.seriesMode ?? current.seriesMode) : false;

    await this.repo.setLibrarySetting(user.id, provider, libraryId, { enabled, features, seriesMode });
    return { libraryId, enabled, features: features as Partial<Record<ReadingServiceFeature, boolean>>, seriesMode };
  }

  /** Resets a library back to "inherit" by deleting its override row. */
  async resetLibrarySetting(user: RequestUser, provider: ReadingServiceProvider, libraryId: number): Promise<void> {
    const accessible = new Set(await this.libraryService.findAccessibleLibraryIds(user));
    if (!accessible.has(libraryId)) {
      throw new Error(`Library ${libraryId} is not accessible to user ${user.id}`);
    }
    await this.repo.deleteLibrarySetting(user.id, provider, libraryId);
  }
}
