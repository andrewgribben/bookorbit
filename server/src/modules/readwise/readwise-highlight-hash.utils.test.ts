import { describe, expect, it } from 'vitest';

import { readwiseHighlightContentHash } from './readwise-highlight-hash.utils';

describe('readwiseHighlightContentHash', () => {
  it('produces a stable 64-char hex digest for the same text/note', () => {
    const a = readwiseHighlightContentHash('hello', 'note');
    const b = readwiseHighlightContentHash('hello', 'note');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('differs when the text changes', () => {
    expect(readwiseHighlightContentHash('hello', 'note')).not.toBe(readwiseHighlightContentHash('hello!', 'note'));
  });

  it('differs when the note changes', () => {
    expect(readwiseHighlightContentHash('hello', 'note')).not.toBe(readwiseHighlightContentHash('hello', 'note2'));
  });

  it('treats a null note the same as an empty string note', () => {
    expect(readwiseHighlightContentHash('hello', null)).toBe(readwiseHighlightContentHash('hello', ''));
  });

  it('does not collide text/note across the separator (e.g. "ab"+"c" vs "a"+"bc")', () => {
    expect(readwiseHighlightContentHash('ab', 'c')).not.toBe(readwiseHighlightContentHash('a', 'bc'));
  });
});
