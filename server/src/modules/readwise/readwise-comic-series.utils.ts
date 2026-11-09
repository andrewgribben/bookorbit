import type { ReadwiseBookStatus } from './readwise-books-client.service';

/** Fallback page count for an issue with no known page count, chosen to match the comic page counts seen in the Readwise API tests. */
export const DEFAULT_COMIC_ISSUE_PAGE_COUNT = 20;

export interface ComicSeriesIssuePages {
  bookId: number;
  pageCount: number | null;
}

export interface ComicSeriesIssuePageMapping {
  bookId: number;
  pageOffset: number;
  issuePages: number;
}

export interface ComicSeriesPageMapping {
  issues: ComicSeriesIssuePageMapping[];
  totalPages: number;
}

/**
 * Maps every issue of a series, in `seriesIndex` order, onto one shared page range: issue N's
 * pages start right after issue N-1's. An issue's own progress (0-100%) maps to series pages via
 * `pageOffset + round(progress / 100 * issuePages)`. Inserting a new issue earlier in the order
 * later shifts every following issue's offset going forward; past sessions keep whatever page
 * numbers they were pushed with (Readwise sessions are immutable), which is accepted.
 */
export function computeComicSeriesPageMapping(
  issues: readonly ComicSeriesIssuePages[],
  fallbackPageCount = DEFAULT_COMIC_ISSUE_PAGE_COUNT,
): ComicSeriesPageMapping {
  let offset = 0;
  const mapped: ComicSeriesIssuePageMapping[] = [];
  for (const issue of issues) {
    const issuePages = issue.pageCount && issue.pageCount > 0 ? issue.pageCount : fallbackPageCount;
    mapped.push({ bookId: issue.bookId, pageOffset: offset, issuePages });
    offset += issuePages;
  }
  return { issues: mapped, totalPages: offset };
}

export interface ComicSeriesIssueStatus {
  bookId: number;
  readwiseStatus: ReadwiseBookStatus | null;
  isLast: boolean;
}

/**
 * Owner-decided status rule for a series book: finished only when the last issue (highest
 * `seriesIndex`) is finished; currently_reading once any issue has any reading activity;
 * otherwise `null` ("not started"), which means don't create the series book yet.
 */
export function computeComicSeriesStatus(issues: readonly ComicSeriesIssueStatus[]): ReadwiseBookStatus | null {
  const last = issues.find((issue) => issue.isLast);
  if (last?.readwiseStatus === 'finished') return 'finished';

  const anyStarted = issues.some((issue) => issue.readwiseStatus !== null);
  return anyStarted ? 'currently_reading' : null;
}
