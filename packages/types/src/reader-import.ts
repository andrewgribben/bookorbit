import type { SeriesFollowStatus } from "./series";

export type ReaderImportSeriesAction = "set" | "kept";

export interface ReaderImportSeries {
  seriesId: number;
  seriesName: string;
  appTitles: string[];
  action: ReaderImportSeriesAction;
  status: SeriesFollowStatus;
  booksToMarkRead: number;
}

export interface ReaderImportUnmatched {
  appTitle: string;
  chapters: number;
  unmatchedChapters: number;
}

export interface ReaderImportNumberMatch {
  appTitle: string;
  chapterName: string;
  seriesName: string;
  seriesIndex: string;
}

export interface ReaderImportResult {
  applied: boolean;
  libraryEntries: number;
  skippedHistoryEntries: number;
  chapters: number;
  matchedChapters: number;
  booksToMarkRead: number;
  series: ReaderImportSeries[];
  numberMatches: ReaderImportNumberMatch[];
  unmatched: ReaderImportUnmatched[];
}
