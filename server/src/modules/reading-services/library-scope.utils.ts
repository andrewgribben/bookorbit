import type { ReadingServiceFeature } from '@bookorbit/types';

/** Effective per-library setting after applying the "missing row = inherit" default. */
export interface EffectiveLibrarySetting {
  enabled: boolean;
  features: Partial<Record<string, boolean>>;
}

export const DEFAULT_LIBRARY_SETTING: EffectiveLibrarySetting = { enabled: true, features: {} };

/**
 * Library ids (out of `accessibleLibraryIds`) where the given feature is effectively usable.
 * `feature === null` checks only whether the library is enabled at all (used for Hardcover's
 * single "does this book sync" decision, which has no per-field push yet).
 *
 * A library override can only narrow a feature that is already on at the provider level - it can
 * never turn on a feature the provider toggle has off (owner decision). So when
 * `providerFeatureEnabled` is false, the result is always empty regardless of library settings.
 */
export function effectiveLibraryIdsForFeature(
  accessibleLibraryIds: readonly number[],
  librarySettings: ReadonlyMap<number, EffectiveLibrarySetting>,
  feature: ReadingServiceFeature | null,
  providerFeatureEnabled = true,
): number[] {
  if (feature !== null && !providerFeatureEnabled) return [];

  return accessibleLibraryIds.filter((id) => {
    const setting = librarySettings.get(id) ?? DEFAULT_LIBRARY_SETTING;
    if (!setting.enabled) return false;
    if (feature === null) return true;
    return setting.features[feature] !== false;
  });
}

/**
 * Whether a book is in scope for a feature, given the (possibly several, future-proofing for
 * multi-library books) library ids it belongs to. A book with no resolvable library id is out of
 * scope. When a book belongs to more than one library, it is in scope if ANY of its accessible
 * libraries allows the feature (owner decision - "allowed if any accessible in-scope library
 * allows it").
 */
export function isBookInScope(effectiveLibraryIds: readonly number[], bookLibraryIds: ReadonlyArray<number | null | undefined>): boolean {
  const effective = new Set(effectiveLibraryIds);
  return bookLibraryIds.some((id) => id != null && effective.has(id));
}

/** Convenience for the common single-library-per-book case used throughout this codebase today. */
export function isLibraryInEffectiveScope(effectiveLibraryIds: readonly number[], libraryId: number | null | undefined): boolean {
  return isBookInScope(effectiveLibraryIds, [libraryId]);
}
