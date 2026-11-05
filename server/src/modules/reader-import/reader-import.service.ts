import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { ReaderImportNumberMatch, ReaderImportResult, ReaderImportSeries, ReaderImportUnmatched, SeriesFollowStatus } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import type { RequestUser } from '../../common/types/request-user';
import { BookService } from '../book/book.service';
import { LibraryService } from '../library/library.service';
import { MigrationRepository } from '../migration/migration.repository';
import { SeriesService } from '../series/series.service';
import { parseMihonBackup, type MihonBackupEntry } from './mihon-backup.parser';
import { ReaderImportRepository, type ReaderImportBookRow } from './reader-import.repository';

/** Mihon's tracker id for Komga and that tracker's "completed" status. */
const KOMGA_TRACKER_ID = 6;
const KOMGA_TRACKER_COMPLETED = 3;
const BOOK_URL = /\/api\/v1\/books\/([^/?#]+)/;

type MatchedChapter = { bookId: number; read: boolean };

interface SeriesPlan {
  seriesId: number;
  seriesName: string;
  appTitles: Set<string>;
  trackerCompleted: boolean;
}

@Injectable()
export class ReaderImportService {
  private readonly logger = new Logger(ReaderImportService.name);

  constructor(
    private readonly repo: ReaderImportRepository,
    private readonly migrationRepo: MigrationRepository,
    private readonly libraryService: LibraryService,
    private readonly bookService: BookService,
    private readonly seriesService: SeriesService,
  ) {}

  /**
   * Turns a Mihon or Komikku backup into BookOrbit reading state: every series in the app library
   * gets a follow status unless the user already chose one, and chapters read in the app are
   * marked read, except books the user marked unread or want-to-read here. Nothing is ever marked unread. With `apply` false it only reports the plan.
   */
  async importMihonBackup(user: RequestUser, file: Buffer, apply: boolean): Promise<ReaderImportResult> {
    const event = 'reader_import.mihon';
    const startedAt = Date.now();
    this.logger.log(`[${event}] [start] userId=${user.id} bytes=${file.length} apply=${apply} - reader backup import started`);
    try {
      const result = await this.buildAndApply(user, this.parse(file), apply);
      this.logger.log(
        `[${event}] [end] userId=${user.id} durationMs=${Date.now() - startedAt} apply=${apply} entries=${result.libraryEntries} ` +
          `matchedChapters=${result.matchedChapters} series=${result.series.length} markRead=${result.booksToMarkRead} - reader backup import completed`,
      );
      return result;
    } catch (error) {
      const errorClass = error instanceof Error ? error.constructor.name : typeof error;
      const message = sanitizeLogValue(error instanceof Error ? error.message : error);
      this.logger.warn(
        `[${event}] [fail] userId=${user.id} durationMs=${Date.now() - startedAt} errorClass=${errorClass} error="${message}" - reader backup import failed`,
      );
      throw error;
    }
  }

  private parse(file: Buffer): MihonBackupEntry[] {
    let entries: MihonBackupEntry[];
    try {
      entries = parseMihonBackup(file);
    } catch {
      throw new BadRequestException('This is not a readable Mihon or Komikku backup');
    }
    if (!entries.some((entry) => entry.url && entry.title)) throw new BadRequestException('No series found in this backup');
    return entries;
  }

  private async buildAndApply(user: RequestUser, entries: MihonBackupEntry[], apply: boolean): Promise<ReaderImportResult> {
    const library = entries.filter((entry) => entry.inLibrary);
    const scope = {
      userId: user.id,
      libraryIds: (await this.libraryService.findAll(user)).map((lib) => lib.id),
      contentFilters: user.isSuperuser ? undefined : user.contentFilters,
    };

    const chapterIds = library.flatMap((entry) => entry.chapters.map((chapter) => BOOK_URL.exec(chapter.url)?.[1] ?? ''));
    const komgaPaths = await this.migrationRepo.findKomgaBookPaths(chapterIds.filter(Boolean));
    // Ids no Komga snapshot knows are BookOrbit's own, which is what a reader pointed at BookOrbit's Komga API stores.
    const ownIds = chapterIds.filter((id) => !komgaPaths.has(id) && /^\d{1,10}$/.test(id)).map(Number);
    const [byPathRows, byIdRows] = await Promise.all([
      this.repo.findBooksByPaths([...new Set(komgaPaths.values())], scope),
      this.repo.findBooksByIds([...new Set(ownIds)], scope),
    ]);
    const bookByPath = new Map(byPathRows.flatMap((row) => (row.path ? [[row.path, row.bookId] as const] : [])));
    const knownBooks = groupByBook([...byPathRows, ...byIdRows]);

    const resolveChapter = (url: string): number | undefined => {
      const id = BOOK_URL.exec(url)?.[1];
      if (!id) return undefined;
      const path = komgaPaths.get(id);
      if (path) return bookByPath.get(path);
      return /^\d{1,10}$/.test(id) && knownBooks.has(Number(id)) ? Number(id) : undefined;
    };

    const firstPass = library.map((entry) => {
      const matched: MatchedChapter[] = [];
      const missing: MihonBackupEntry['chapters'] = [];
      for (const chapter of entry.chapters) {
        const bookId = resolveChapter(chapter.url);
        if (bookId === undefined) missing.push(chapter);
        else matched.push({ bookId, read: chapter.read });
      }
      return { entry, matched, missing, seriesId: dominantSeries(matched, knownBooks) };
    });

    const candidateSeries = new Set<number>();
    for (const pass of firstPass) {
      for (const chapter of pass.matched)
        for (const row of knownBooks.get(chapter.bookId) ?? []) if (row.seriesId !== null) candidateSeries.add(row.seriesId);
    }
    const seriesRows = await this.repo.findSeriesBooks([...candidateSeries], scope);
    for (const [bookId, rows] of groupByBook(seriesRows)) knownBooks.set(bookId, rows);
    const booksBySeries = new Map<number, ReaderImportBookRow[]>();
    for (const row of seriesRows) {
      const list = booksBySeries.get(row.seriesId!) ?? [];
      if (!list.some((existing) => existing.bookId === row.bookId)) list.push(row);
      booksBySeries.set(row.seriesId!, list);
    }

    const numberMatches: ReaderImportNumberMatch[] = [];
    const unmatched: ReaderImportUnmatched[] = [];
    for (const pass of firstPass) {
      const stillMissing = pass.missing.filter((chapter) => {
        if (pass.seriesId === null || chapter.chapterNumber === null) return true;
        const hits = (booksBySeries.get(pass.seriesId) ?? []).filter(
          (row) => row.seriesIndex !== null && Number(row.seriesIndex) === chapter.chapterNumber,
        );
        if (hits.length !== 1 || hits[0]!.seriesIndex === null || pass.matched.some((m) => m.bookId === hits[0]!.bookId)) return true;
        pass.matched.push({ bookId: hits[0]!.bookId, read: chapter.read });
        numberMatches.push({
          appTitle: pass.entry.title,
          chapterName: chapter.name,
          seriesName: hits[0]!.seriesName ?? '',
          seriesIndex: hits[0]!.seriesIndex,
        });
        return false;
      });
      if (stillMissing.length > 0 || pass.entry.chapters.length === 0) {
        unmatched.push({ appTitle: pass.entry.title, chapters: pass.entry.chapters.length, unmatchedChapters: stillMissing.length });
      }
    }

    const markRead = new Set<number>();
    const plans = new Map<number, SeriesPlan>();
    for (const pass of firstPass) {
      const trackerCompleted = pass.entry.trackerStatuses.some((t) => t.trackerId === KOMGA_TRACKER_ID && t.status === KOMGA_TRACKER_COMPLETED);
      for (const chapter of pass.matched) {
        const rows = knownBooks.get(chapter.bookId) ?? [];
        if (chapter.read && !isRead(rows[0]?.readStatus ?? null) && !isExplicitlyUnread(rows[0]?.readStatus ?? null)) markRead.add(chapter.bookId);
        for (const row of rows) {
          if (row.seriesId === null) continue;
          const plan = plans.get(row.seriesId) ?? {
            seriesId: row.seriesId,
            seriesName: row.seriesName ?? '',
            appTitles: new Set<string>(),
            trackerCompleted: false,
          };
          plan.appTitles.add(pass.entry.title);
          plan.trackerCompleted ||= trackerCompleted;
          plans.set(row.seriesId, plan);
        }
      }
    }

    const existing = await this.repo.findFollowStatuses(user.id, [...plans.keys()]);
    const series: ReaderImportSeries[] = [...plans.values()].map((plan) => {
      const books = booksBySeries.get(plan.seriesId) ?? [];
      const kept = existing.get(plan.seriesId);
      const fullyRead = books.length > 0 && books.every((book) => markRead.has(book.bookId) || isRead(book.readStatus));
      const status: SeriesFollowStatus = kept ?? (plan.trackerCompleted ? 'completed' : fullyRead ? 'caught_up' : 'reading');
      return {
        seriesId: plan.seriesId,
        seriesName: plan.seriesName,
        appTitles: [...plan.appTitles].sort(),
        action: kept ? 'kept' : 'set',
        status,
        booksToMarkRead: books.filter((book) => markRead.has(book.bookId)).length,
      };
    });
    series.sort((a, b) => a.seriesName.localeCompare(b.seriesName));

    if (apply) {
      if (markRead.size > 0) await this.bookService.bulkSetStatus([...markRead], 'read', user);
      for (const item of series) {
        if (item.action === 'set') await this.seriesService.setFollowStatus(user, item.seriesId, { status: item.status });
      }
    }

    return {
      applied: apply,
      libraryEntries: library.length,
      skippedHistoryEntries: entries.length - library.length,
      chapters: library.reduce((sum, entry) => sum + entry.chapters.length, 0),
      matchedChapters: firstPass.reduce((sum, pass) => sum + pass.matched.length, 0),
      booksToMarkRead: markRead.size,
      series,
      numberMatches,
      unmatched: unmatched.sort((a, b) => a.appTitle.localeCompare(b.appTitle)),
    };
  }
}

function isRead(status: string | null): boolean {
  return status === 'read' || status === 'skimmed';
}

// Matches the Up Next rule: these are the user's deliberate overrides of reading progress.
function isExplicitlyUnread(status: string | null): boolean {
  return status === 'unread' || status === 'want_to_read';
}

function groupByBook(rows: ReaderImportBookRow[]): Map<number, ReaderImportBookRow[]> {
  const out = new Map<number, ReaderImportBookRow[]>();
  for (const row of rows) {
    const list = out.get(row.bookId) ?? [];
    if (!list.some((existing) => existing.seriesId === row.seriesId)) list.push(row);
    out.set(row.bookId, list);
  }
  return out;
}

/** The BookOrbit series most of an app entry's matched chapters belong to; issue-number matching stays inside it. */
function dominantSeries(matched: MatchedChapter[], books: Map<number, ReaderImportBookRow[]>): number | null {
  const counts = new Map<number, number>();
  for (const chapter of matched) {
    for (const row of books.get(chapter.bookId) ?? []) {
      if (row.seriesId !== null) counts.set(row.seriesId, (counts.get(row.seriesId) ?? 0) + 1);
    }
  }
  let best: number | null = null;
  for (const [seriesId, count] of counts) if (best === null || count > counts.get(best)!) best = seriesId;
  return best;
}
