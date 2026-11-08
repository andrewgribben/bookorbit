import { describe, expect, it } from 'vitest';

import { classifyReadwiseOwnership } from './readwise-book-ownership';

describe('classifyReadwiseOwnership', () => {
  it.each(['kindle', 'audible', 'bookstore_ebook', 'uploaded_ebook', 'physical'])('classifies %s as owned', (origin) => {
    expect(classifyReadwiseOwnership(origin)).toBe('owned');
  });

  it.each(['goodreads', 'storygraph', 'api'])('classifies %s as not_owned', (origin) => {
    expect(classifyReadwiseOwnership(origin)).toBe('not_owned');
  });

  it.each(['bookwise', 'glose_migration', 'some_future_origin'])('classifies an unrecognised origin %s as unknown', (origin) => {
    expect(classifyReadwiseOwnership(origin)).toBe('unknown');
  });

  it('classifies a missing creation_origin as unknown, never owned', () => {
    expect(classifyReadwiseOwnership(null)).toBe('unknown');
    expect(classifyReadwiseOwnership(undefined)).toBe('unknown');
  });
});
