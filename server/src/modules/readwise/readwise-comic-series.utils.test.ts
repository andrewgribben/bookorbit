import { describe, expect, it } from 'vitest';

import { computeComicSeriesPageMapping, computeComicSeriesStatus, DEFAULT_COMIC_ISSUE_PAGE_COUNT } from './readwise-comic-series.utils';

describe('computeComicSeriesPageMapping', () => {
  it('maps issues onto a contiguous page range in order, offsetting each by the previous issues total', () => {
    const result = computeComicSeriesPageMapping([
      { bookId: 1, pageCount: 20 },
      { bookId: 2, pageCount: 24 },
      { bookId: 3, pageCount: 18 },
    ]);

    expect(result.issues).toEqual([
      { bookId: 1, pageOffset: 0, issuePages: 20 },
      { bookId: 2, pageOffset: 20, issuePages: 24 },
      { bookId: 3, pageOffset: 44, issuePages: 18 },
    ]);
    expect(result.totalPages).toBe(62);
  });

  it('falls back to a default page count for an issue with no known page count', () => {
    const result = computeComicSeriesPageMapping([
      { bookId: 1, pageCount: null },
      { bookId: 2, pageCount: 0 },
    ]);

    expect(result.issues).toEqual([
      { bookId: 1, pageOffset: 0, issuePages: DEFAULT_COMIC_ISSUE_PAGE_COUNT },
      { bookId: 2, pageOffset: DEFAULT_COMIC_ISSUE_PAGE_COUNT, issuePages: DEFAULT_COMIC_ISSUE_PAGE_COUNT },
    ]);
    expect(result.totalPages).toBe(DEFAULT_COMIC_ISSUE_PAGE_COUNT * 2);
  });

  it('accepts a custom fallback page count', () => {
    const result = computeComicSeriesPageMapping([{ bookId: 1, pageCount: null }], 30);
    expect(result.issues[0]).toEqual({ bookId: 1, pageOffset: 0, issuePages: 30 });
  });

  it('inserting an issue only shifts the offsets of issues after it going forward (not past sessions)', () => {
    const before = computeComicSeriesPageMapping([
      { bookId: 1, pageCount: 20 },
      { bookId: 3, pageCount: 18 },
    ]);
    const after = computeComicSeriesPageMapping([
      { bookId: 1, pageCount: 20 },
      { bookId: 2, pageCount: 24 },
      { bookId: 3, pageCount: 18 },
    ]);

    expect(before.issues.find((i) => i.bookId === 3)?.pageOffset).toBe(20);
    expect(after.issues.find((i) => i.bookId === 3)?.pageOffset).toBe(44);
  });
});

describe('computeComicSeriesStatus', () => {
  it('returns null (not started) when no issue has any activity', () => {
    const result = computeComicSeriesStatus([
      { bookId: 1, readwiseStatus: null, isLast: false },
      { bookId: 2, readwiseStatus: null, isLast: true },
    ]);
    expect(result).toBeNull();
  });

  it('returns currently_reading once any issue is started but the last issue is not finished', () => {
    const result = computeComicSeriesStatus([
      { bookId: 1, readwiseStatus: 'currently_reading', isLast: false },
      { bookId: 2, readwiseStatus: null, isLast: true },
    ]);
    expect(result).toBe('currently_reading');
  });

  it('returns finished only when the last issue (highest seriesIndex) is finished', () => {
    const result = computeComicSeriesStatus([
      { bookId: 1, readwiseStatus: 'currently_reading', isLast: false },
      { bookId: 2, readwiseStatus: 'finished', isLast: true },
    ]);
    expect(result).toBe('finished');
  });

  it('does not report finished just because an earlier issue finished while the last one has not started', () => {
    const result = computeComicSeriesStatus([
      { bookId: 1, readwiseStatus: 'finished', isLast: false },
      { bookId: 2, readwiseStatus: null, isLast: true },
    ]);
    expect(result).toBe('currently_reading');
  });
});
