import { describe, expect, it } from 'vitest';

import { mapBookOrbitStatusToReadwise, mapReadwiseStatusToBookOrbit } from './readwise-books-status-mapping';

describe('mapBookOrbitStatusToReadwise', () => {
  it('does not push unread books', () => {
    expect(mapBookOrbitStatusToReadwise('unread')).toBeNull();
  });

  it.each([
    ['want_to_read', 'want_to_read'],
    ['reading', 'currently_reading'],
    ['rereading', 'currently_reading'],
    ['on_hold', 'currently_reading'],
    ['read', 'finished'],
    ['skimmed', 'finished'],
    ['abandoned', 'did_not_finish'],
  ] as const)('maps %s to %s', (local, remote) => {
    expect(mapBookOrbitStatusToReadwise(local)).toBe(remote);
  });
});

describe('mapReadwiseStatusToBookOrbit', () => {
  it('maps want_to_read straight across', () => {
    expect(mapReadwiseStatusToBookOrbit('want_to_read', null)).toBe('want_to_read');
  });

  it('maps currently_reading to reading by default', () => {
    expect(mapReadwiseStatusToBookOrbit('currently_reading', null)).toBe('reading');
  });

  it.each(['rereading', 'on_hold'] as const)('keeps a local %s status under currently_reading', (local) => {
    expect(mapReadwiseStatusToBookOrbit('currently_reading', local)).toBe(local);
  });

  it('maps finished to read by default', () => {
    expect(mapReadwiseStatusToBookOrbit('finished', null)).toBe('read');
  });

  it('keeps a local skimmed status under finished', () => {
    expect(mapReadwiseStatusToBookOrbit('finished', 'skimmed')).toBe('skimmed');
  });

  it('maps did_not_finish to abandoned', () => {
    expect(mapReadwiseStatusToBookOrbit('did_not_finish', null)).toBe('abandoned');
  });

  it.each(['unsorted', 'deleted'] as const)('makes no local change for %s', (remote) => {
    expect(mapReadwiseStatusToBookOrbit(remote, 'reading')).toBeNull();
  });
});
