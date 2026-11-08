import { describe, expect, it } from 'vitest';

import { DEFAULT_LIBRARY_SETTING, effectiveLibraryIdsForFeature, isBookInScope, isLibraryInEffectiveScope } from './library-scope.utils';

describe('effectiveLibraryIdsForFeature', () => {
  it('includes every accessible library when no settings row exists (missing row = inherit)', () => {
    const result = effectiveLibraryIdsForFeature([1, 2, 3], new Map(), 'owned');
    expect(result).toEqual([1, 2, 3]);
  });

  it('a library override can narrow a provider feature that is on', () => {
    const settings = new Map([[2, { enabled: true, features: { owned: false } }]]);
    const result = effectiveLibraryIdsForFeature([1, 2, 3], settings, 'owned');
    expect(result).toEqual([1, 3]);
  });

  it('a library override can never widen a provider feature that is off', () => {
    const settings = new Map([[2, { enabled: true, features: { owned: true } }]]);
    const result = effectiveLibraryIdsForFeature([1, 2, 3], settings, 'owned', false);
    expect(result).toEqual([]);
  });

  it('a disabled library excludes all features, including ones explicitly turned on for it', () => {
    const settings = new Map([[2, { enabled: false, features: { owned: true } }]]);
    const result = effectiveLibraryIdsForFeature([1, 2, 3], settings, 'owned');
    expect(result).toEqual([1, 3]);
  });

  it('feature=null checks only the enabled flag, for providers with no per-field push yet', () => {
    const settings = new Map([[2, { enabled: false, features: {} }]]);
    const result = effectiveLibraryIdsForFeature([1, 2, 3], settings, null);
    expect(result).toEqual([1, 3]);
  });

  it('DEFAULT_LIBRARY_SETTING is the inherited default: enabled, no feature overrides', () => {
    expect(DEFAULT_LIBRARY_SETTING).toEqual({ enabled: true, features: {} });
  });
});

describe('isBookInScope', () => {
  it('a book in a single in-scope library is in scope', () => {
    expect(isBookInScope([1, 2], [1])).toBe(true);
  });

  it('a book in a single out-of-scope library is out of scope', () => {
    expect(isBookInScope([1, 2], [3])).toBe(false);
  });

  it('a book with no resolvable library id is out of scope', () => {
    expect(isBookInScope([1, 2], [null, undefined])).toBe(false);
  });

  it('a multi-library book is in scope if ANY of its libraries is in scope', () => {
    expect(isBookInScope([2], [3, 2])).toBe(true);
  });

  it('a multi-library book is out of scope only if NONE of its libraries is in scope', () => {
    expect(isBookInScope([5], [3, 2])).toBe(false);
  });
});

describe('isLibraryInEffectiveScope', () => {
  it('is in scope when the library id is in the effective set', () => {
    expect(isLibraryInEffectiveScope([1, 2], 1)).toBe(true);
  });

  it('is out of scope when the library id is missing from the effective set', () => {
    expect(isLibraryInEffectiveScope([1, 2], 3)).toBe(false);
  });

  it('is out of scope when the library id is null', () => {
    expect(isLibraryInEffectiveScope([1, 2], null)).toBe(false);
  });
});
