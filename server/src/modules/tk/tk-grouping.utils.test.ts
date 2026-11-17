import { describe, expect, it } from 'vitest';

import { groupItemsByDateKey } from './tk-grouping.utils';
import type { TkAnnotationItem } from './tk.types';

function annotation(overrides: Partial<TkAnnotationItem>): TkAnnotationItem {
  return {
    kind: 'annotation',
    sourceKey: '1',
    dateKey: '2026-11-17',
    occurredAt: new Date('2026-11-17T10:00:00Z'),
    bookId: 7,
    bookTitle: 'Dune',
    bookAuthor: 'Frank Herbert',
    text: 'text',
    note: null,
    url: 'https://library.grib.co/book/7',
    ...overrides,
  };
}

describe('groupItemsByDateKey', () => {
  it('groups items into buckets keyed by their dateKey', () => {
    const grouped = groupItemsByDateKey([
      annotation({ sourceKey: '1', dateKey: '2026-11-17' }),
      annotation({ sourceKey: '2', dateKey: '2026-11-18' }),
      annotation({ sourceKey: '3', dateKey: '2026-11-17' }),
    ]);
    expect([...grouped.keys()]).toEqual(['2026-11-17', '2026-11-18']);
    expect(grouped.get('2026-11-17')?.map((i) => i.sourceKey)).toEqual(['1', '3']);
  });

  it('returns days oldest first even when items arrive out of order', () => {
    const grouped = groupItemsByDateKey([
      annotation({ sourceKey: '1', dateKey: '2026-11-20' }),
      annotation({ sourceKey: '2', dateKey: '2026-11-05' }),
      annotation({ sourceKey: '3', dateKey: '2026-11-17' }),
    ]);
    expect([...grouped.keys()]).toEqual(['2026-11-05', '2026-11-17', '2026-11-20']);
  });

  it('orders items inside a day by occurredAt, independent of input order', () => {
    const grouped = groupItemsByDateKey([
      annotation({ sourceKey: 'late', dateKey: '2026-11-17', occurredAt: new Date('2026-11-17T20:00:00Z') }),
      annotation({ sourceKey: 'early', dateKey: '2026-11-17', occurredAt: new Date('2026-11-17T01:00:00Z') }),
    ]);
    expect(grouped.get('2026-11-17')?.map((i) => i.sourceKey)).toEqual(['early', 'late']);
  });

  it('keeps a day crossing a timezone boundary (same local day, different UTC instants) as one bucket', () => {
    // A user in a timezone ahead of UTC can have two UTC-adjacent events land on the same local day.
    const grouped = groupItemsByDateKey([
      annotation({ sourceKey: '1', dateKey: '2026-11-17', occurredAt: new Date('2026-11-16T23:30:00Z') }),
      annotation({ sourceKey: '2', dateKey: '2026-11-17', occurredAt: new Date('2026-11-17T00:30:00Z') }),
    ]);
    expect(grouped.size).toBe(1);
    expect(grouped.get('2026-11-17')?.map((i) => i.sourceKey)).toEqual(['1', '2']);
  });

  it('returns an empty map for no items', () => {
    expect(groupItemsByDateKey([]).size).toBe(0);
  });
});
