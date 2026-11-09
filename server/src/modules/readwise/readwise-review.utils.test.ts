import { describe, expect, it } from 'vitest';

import { normalizeReadwiseReview } from './readwise-review.utils';

describe('normalizeReadwiseReview', () => {
  it('passes a non-empty trimmed review through unchanged', () => {
    expect(normalizeReadwiseReview('Great book')).toBe('Great book');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeReadwiseReview('  Great book  ')).toBe('Great book');
  });

  it('coerces an empty string to null', () => {
    expect(normalizeReadwiseReview('')).toBeNull();
  });

  it('coerces a whitespace-only string to null', () => {
    expect(normalizeReadwiseReview('   \n\t  ')).toBeNull();
  });

  it('passes null through as null', () => {
    expect(normalizeReadwiseReview(null)).toBeNull();
  });

  it('treats undefined the same as null', () => {
    expect(normalizeReadwiseReview(undefined)).toBeNull();
  });

  it('caps a review longer than 10000 characters', () => {
    const long = 'a'.repeat(10005);
    const result = normalizeReadwiseReview(long);
    expect(result).toHaveLength(10000);
    expect(result).toBe('a'.repeat(10000));
  });

  it('leaves a review at exactly 10000 characters untouched', () => {
    const exact = 'b'.repeat(10000);
    expect(normalizeReadwiseReview(exact)).toBe(exact);
  });

  it('trims before capping so trailing whitespace does not count toward the cap', () => {
    const long = 'c'.repeat(10000) + '   ';
    expect(normalizeReadwiseReview(long)).toBe('c'.repeat(10000));
  });
});
