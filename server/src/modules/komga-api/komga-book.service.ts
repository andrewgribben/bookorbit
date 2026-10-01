import { stat } from 'fs/promises';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Permission, isComicFormat, type BookCard, type EpubBookInfo } from '@bookorbit/types';
import { contentDispositionHeader } from '../../common/utils/content-disposition.utils';
import { sendFileWithRange } from '../../common/utils/range-response.utils';
import { PermissionService } from '../../common/services/permission.service';
import type { RequestUser } from '../../common/types/request-user';
import { BookService } from '../book/book.service';
import type { BookDetailDto } from '../book/dto/book-detail.dto';
import { CbzService } from '../reader/cbz/cbz.service';
import { EpubService } from '../reader/epub/epub.service';
import { LibraryService } from '../library/library.service';
import type { KomgaBook, KomgaPageEntry, KomgaR2Positions, KomgaR2Progression } from './komga-api.types';
import { decodeKomgaId, komgaNotFound } from './komga-ids';
import type { KomgaBookFileFact, KomgaBookSource, KomgaPageSource, KomgaProgressSource } from './komga.mappers';
import {
  komgaMediaProfile,
  komgaMediaType,
  toKomgaBook,
  toKomgaDivinaManifest,
  toKomgaEpubManifest,
  toKomgaEpubPositions,
  toKomgaEpubProgression,
  toKomgaPageEntry,
  toKomgaPositions,
  toKomgaProgression,
} from './komga.mappers';
import type { KomgaBookFact, KomgaProgressRow } from './komga.repository';
import { KomgaRepository } from './komga.repository';

const DIVINA_MANIFEST_CONTENT_TYPE = 'application/divina+json';
const EPUB_MANIFEST_CONTENT_TYPE = 'application/webpub+json';

export interface KomgaReadProgressUpdate {
  page?: number;
  completed?: boolean;
  /** Set by the Readium progression path, where the percentage is known but the page is not. */
  percentage?: number;
}

export interface KomgaProgressionInput {
  locator: {
    locations?: { position?: number; totalProgression?: number };
  };
}

@Injectable()
export class KomgaBookService {
  constructor(
    private readonly repo: KomgaRepository,
    private readonly bookService: BookService,
    private readonly libraryService: LibraryService,
    private readonly cbzService: CbzService,
    private readonly epubService: EpubService,
    private readonly permissionService: PermissionService,
  ) {}

  private toFileFact(fact: KomgaBookFact | undefined): KomgaBookFileFact | null {
    if (!fact || fact.fileId === null) return null;
    return {
      id: fact.fileId,
      format: fact.format,
      role: fact.role ?? 'content',
      sizeBytes: fact.sizeBytes,
      fileHash: fact.fileHash,
      mtime: fact.mtime ? fact.mtime.toISOString() : null,
    };
  }

  private toProgressSource(progress: KomgaProgressRow | null, statusUpdatedAt: string | null, status: string | null): KomgaProgressSource | null {
    if (progress) {
      return {
        pageNumber: progress.pageNumber,
        percentage: progress.percentage,
        lastModified: progress.updatedAt.toISOString(),
        lastReadAt: progress.lastReadAt.toISOString(),
      };
    }
    // A book marked read by hand has no progress row; report the status so clients still see it.
    if (!status || !statusUpdatedAt) return null;
    return {
      pageNumber: null,
      percentage: status === 'read' ? 100 : 0,
      lastModified: statusUpdatedAt,
      lastReadAt: statusUpdatedAt,
    };
  }

  async toKomgaBooks(user: RequestUser, cards: BookCard[]): Promise<KomgaBook[]> {
    const bookIds = cards.map((card) => card.id);
    const [facts, progressRows] = await Promise.all([this.repo.findBookFacts(bookIds), this.repo.findProgressByBookIds(user.id, bookIds)]);
    const factByBookId = new Map(facts.map((fact) => [fact.bookId, fact]));
    const progressByBookId = new Map(progressRows.map((row) => [row.bookId, row]));

    return cards.map((card) =>
      toKomgaBook({
        id: card.id,
        libraryId: factByBookId.get(card.id)?.libraryId ?? 0,
        status: card.status,
        title: card.title,
        description: null,
        authors: card.authors,
        genres: card.genres,
        tags: card.tags,
        seriesId: card.seriesId ?? null,
        seriesName: card.seriesName,
        seriesIndex: card.seriesIndex,
        primaryFile: this.toFileFact(factByBookId.get(card.id)),
        pageCount: card.pageCount,
        publishedDate: card.publishedDate,
        language: card.language,
        isbn13: card.isbn13,
        publisher: card.publisher,
        addedAt: card.addedAt,
        updatedAt: card.updatedAt,
        readStatus: card.readStatus?.status ?? null,
        progress: this.toProgressSource(progressByBookId.get(card.id) ?? null, card.readStatus?.updatedAt ?? null, card.readStatus?.status ?? null),
      }),
    );
  }

  private async detailToSource(user: RequestUser, bookId: number): Promise<KomgaBookSource> {
    const detail: BookDetailDto = await this.bookService.getDetail(bookId, user);
    const [facts, progressRows] = await Promise.all([this.repo.findBookFacts([bookId]), this.repo.findProgressByBookIds(user.id, [bookId])]);
    const fact = facts[0];
    // `book_metadata.series_id` is a denormalized copy the scanner does not always fill; an empty
    // seriesId makes Komga clients request `/series/` with no id, so the membership table decides.
    const membership = detail.seriesId === null ? await this.repo.findSeriesMembershipForBook(bookId) : null;

    return {
      id: detail.id,
      libraryId: fact?.libraryId ?? detail.libraryId,
      status: detail.status,
      title: detail.title,
      description: detail.description,
      authors: detail.authors.map((author) => author.name),
      genres: detail.genres,
      tags: detail.tags,
      seriesId: detail.seriesId ?? membership?.seriesId ?? null,
      seriesName: detail.seriesName ?? membership?.seriesName ?? null,
      seriesIndex: detail.seriesIndex ?? membership?.seriesIndex ?? null,
      primaryFile: this.toFileFact(fact),
      pageCount: detail.pageCount,
      publishedDate: detail.publishedDate,
      language: detail.language,
      isbn13: detail.isbn13,
      publisher: detail.publisher,
      addedAt: detail.addedAt,
      updatedAt: detail.updatedAt,
      readStatus: detail.readStatus?.status ?? null,
      progress: this.toProgressSource(progressRows[0] ?? null, detail.readStatus?.updatedAt ?? null, detail.readStatus?.status ?? null),
    };
  }

  async getBook(user: RequestUser, rawBookId: string): Promise<KomgaBook> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    return toKomgaBook(await this.detailToSource(user, bookId));
  }

  async getNeighbour(user: RequestUser, rawBookId: string, direction: 'next' | 'previous'): Promise<KomgaBook> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    if (source.seriesId === null) throw komgaNotFound('book', bookId);

    const libraryIds = await this.libraryService.findAccessibleLibraryIds(user);
    const neighbours = await this.repo.findSeriesNeighbours({
      seriesId: source.seriesId,
      bookId,
      libraryIds,
      contentFilters: user.isSuperuser ? undefined : user.contentFilters,
    });
    const neighbourId = direction === 'next' ? neighbours.nextBookId : neighbours.previousBookId;
    if (neighbourId === null) throw komgaNotFound('book', bookId);

    return toKomgaBook(await this.detailToSource(user, neighbourId));
  }

  /** Page streaming needs a comic archive; Komga refuses anything else on this route. */
  private async resolveComicFile(user: RequestUser, bookId: number): Promise<number> {
    const source = await this.detailToSource(user, bookId);
    const format = source.primaryFile?.format?.toLowerCase() ?? '';
    if (!source.primaryFile || !isComicFormat(format)) {
      throw new BadRequestException('Page streaming is only available for comic archives (cbz, cbr, cb7, cbx)');
    }
    return source.primaryFile.id;
  }

  private async loadPageSources(user: RequestUser, bookId: number): Promise<KomgaPageSource[]> {
    const fileId = await this.resolveComicFile(user, bookId);
    return this.cbzService.listPages(fileId, user);
  }

  private async loadEpubInfo(user: RequestUser, bookId: number, source: KomgaBookSource): Promise<EpubBookInfo> {
    if (komgaMediaProfile(source.primaryFile?.format) !== 'EPUB') {
      throw new BadRequestException(`Book media type '${source.primaryFile?.format ?? 'unknown'}' is not compatible with the EPUB profile`);
    }
    return this.epubService.getBookInfo(bookId, source.primaryFile?.id, user);
  }

  async listPages(user: RequestUser, rawBookId: string): Promise<KomgaPageEntry[]> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    // Komga answers a non-divina book with an empty list, not an error: its analyzed `media.pages`
    // is empty for EPUB, and clients (KMReader preloads segment pages for every profile) treat a
    // failure here as a reader error.
    if (komgaMediaProfile(source.primaryFile?.format) !== 'DIVINA') return [];

    const pages = await this.loadPageSources(user, bookId);
    return pages.map((page, index) => toKomgaPageEntry(page, index));
  }

  /** Komga page numbers are 1-based; BookOrbit's archive indexes are 0-based. */
  async streamPage(user: RequestUser, rawBookId: string, pageNumber: number, reply: FastifyReply): Promise<void> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    if (!Number.isInteger(pageNumber) || pageNumber < 1) throw new NotFoundException(`Unknown page: ${pageNumber}`);

    const fileId = await this.resolveComicFile(user, bookId);
    const { stream, mimeType } = await this.cbzService.streamPage(fileId, pageNumber - 1, user);

    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    reply.type(mimeType);
    reply.send(stream);
  }

  async downloadFile(user: RequestUser, rawBookId: string, rangeHeader: string | undefined, reply: FastifyReply): Promise<void> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    if (!source.primaryFile) throw new NotFoundException(`Book ${bookId} has no file`);
    // Matches the native download route: reading is open, downloading is a granted permission.
    if (!this.permissionService.userHas(user, Permission.LibraryDownload)) {
      throw new ForbiddenException('Missing permission: library_download');
    }

    const fileId = source.primaryFile.id;
    const info = await this.bookService.getFileInfo(fileId, user);
    const filename = await this.bookService.resolveDownloadFilename({
      bookId: info.bookId,
      absolutePath: info.path,
      format: info.format === 'unknown' ? null : info.format,
      mediaOverlayAvailable: info.mediaOverlayAvailable,
    });

    reply.header('Content-Disposition', contentDispositionHeader('attachment', filename, 'download'));
    reply.type(komgaMediaType(info.format));
    sendFileWithRange(reply, info.path, info.size, rangeHeader);
  }

  async streamCover(user: RequestUser, bookId: number, reply: FastifyReply): Promise<void> {
    const path = await this.bookService.getCoverPath(bookId, user);
    if (!path) throw new NotFoundException(`Book ${bookId} has no cover`);
    const { size } = await stat(path);
    reply.header('Cache-Control', 'public, max-age=86400');
    reply.type(komgaMediaType(path.split('.').pop() ?? null));
    sendFileWithRange(reply, path, size, undefined);
  }

  async streamThumbnail(user: RequestUser, bookId: number, reply: FastifyReply): Promise<void> {
    // The scanner extracts a cover but does not always produce the thumbnail variant, and Komga
    // clients render a cover for every book, so the cover stands in when the thumbnail is absent.
    const path = (await this.bookService.getThumbnailPath(bookId, user)) ?? (await this.bookService.getCoverPath(bookId, user));
    if (!path) throw new NotFoundException(`Book ${bookId} has no thumbnail`);
    const { size } = await stat(path);
    reply.header('Cache-Control', 'public, max-age=86400');
    reply.type(path.endsWith('.png') ? 'image/png' : 'image/jpeg');
    sendFileWithRange(reply, path, size, undefined);
  }

  async downloadCover(user: RequestUser, rawBookId: string, reply: FastifyReply): Promise<void> {
    await this.streamCover(user, decodeKomgaId(rawBookId, 'book'), reply);
  }

  async downloadThumbnail(user: RequestUser, rawBookId: string, reply: FastifyReply): Promise<void> {
    await this.streamThumbnail(user, decodeKomgaId(rawBookId, 'book'), reply);
  }

  async getPositions(user: RequestUser, rawBookId: string): Promise<KomgaR2Positions> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    if (komgaMediaProfile(source.primaryFile?.format) === 'EPUB') {
      return toKomgaEpubPositions(await this.loadEpubInfo(user, bookId, source), bookId);
    }
    return toKomgaPositions(await this.loadPageSources(user, bookId), bookId);
  }

  async getProgression(user: RequestUser, rawBookId: string): Promise<KomgaR2Progression> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    if (komgaMediaProfile(source.primaryFile?.format) === 'EPUB') {
      return toKomgaEpubProgression(source, await this.loadEpubInfo(user, bookId, source), bookId);
    }
    return toKomgaProgression(source, bookId);
  }

  async saveProgression(user: RequestUser, rawBookId: string, progression: KomgaProgressionInput): Promise<void> {
    const position = progression.locator?.locations?.position;
    const totalProgression = progression.locator?.locations?.totalProgression;

    const epubPercentage = await this.epubProgressionPercentage(user, rawBookId, progression);
    if (epubPercentage !== undefined) {
      await this.saveReadProgress(user, rawBookId, { completed: epubPercentage === 100, percentage: epubPercentage });
      return;
    }

    const page = typeof position === 'number' && position > 0 ? position : undefined;
    const percentage = typeof totalProgression === 'number' ? Math.round(Math.min(Math.max(totalProgression, 0), 1) * 100) : undefined;

    await this.saveReadProgress(user, rawBookId, { page, completed: percentage === 100 });
  }

  /**
   * EPUB locators are href-based, so the stored percentage comes from the locator's own progress or
   * from the spine document it names. Returns undefined for a non-EPUB book.
   */
  private async epubProgressionPercentage(user: RequestUser, rawBookId: string, progression: KomgaProgressionInput): Promise<number | undefined> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    if (komgaMediaProfile(source.primaryFile?.format) !== 'EPUB') return undefined;

    const totalProgression = progression.locator?.locations?.totalProgression;
    if (typeof totalProgression === 'number') {
      return Math.round(Math.min(Math.max(totalProgression, 0), 1) * 100);
    }

    const href = (progression.locator as { href?: string } | undefined)?.href;
    if (!href) return undefined;
    const info = await this.loadEpubInfo(user, bookId, source);
    const spine = info.spine.filter((item) => item.linear !== false);
    const index = spine.findIndex((item) => href.endsWith(item.href));
    if (index < 0 || spine.length === 0) return undefined;
    return Math.round(((index + 1) / spine.length) * 100);
  }

  /** Percentage derived from page count; keeps current percentage when page count is unknown. */
  async saveReadProgress(user: RequestUser, rawBookId: string, update: KomgaReadProgressUpdate): Promise<void> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    const file = source.primaryFile;
    if (!file) throw new NotFoundException(`Book ${bookId} has no file`);

    const current = await this.bookService.getProgress(user.id, file.id, user);
    const completed = update.completed === true;

    let percentage = completed ? 100 : (update.percentage ?? current?.percentage ?? 0);
    if (!completed && update.percentage === undefined && update.page !== undefined && (source.pageCount ?? 0) > 0) {
      percentage = Math.min(100, Math.round((update.page / (source.pageCount as number)) * 100));
    }

    await this.bookService.saveProgress(user.id, file.id, { percentage, pageNumber: update.page ?? current?.pageNumber ?? null }, user);

    if (completed) await this.bookService.setReadStatus(bookId, { status: 'read' }, user);
  }

  async clearReadProgress(user: RequestUser, rawBookId: string): Promise<void> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    await this.bookService.clearBookProgressForReread(user.id, bookId, user);
  }

  /**
   * Komga picks the manifest from the book's own media profile: Divina for comic archives, a
   * Readium webpub publication for EPUB. Clients ask for the one they can render.
   */
  async getManifest(user: RequestUser, rawBookId: string): Promise<{ contentType: string; manifest: Record<string, unknown> }> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);

    if (komgaMediaProfile(source.primaryFile?.format) === 'EPUB') {
      return {
        contentType: EPUB_MANIFEST_CONTENT_TYPE,
        manifest: toKomgaEpubManifest(source, await this.loadEpubInfo(user, bookId, source), bookId),
      };
    }

    const pages = await this.loadPageSources(user, bookId);
    return { contentType: DIVINA_MANIFEST_CONTENT_TYPE, manifest: toKomgaDivinaManifest(source, pages, bookId) };
  }

  async getEpubManifest(user: RequestUser, rawBookId: string): Promise<{ contentType: string; manifest: Record<string, unknown> }> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    return { contentType: EPUB_MANIFEST_CONTENT_TYPE, manifest: toKomgaEpubManifest(source, await this.loadEpubInfo(user, bookId, source), bookId) };
  }

  async getDivinaManifest(user: RequestUser, rawBookId: string): Promise<{ contentType: string; manifest: Record<string, unknown> }> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    // Komga does not check the profile on this route: a non-divina book yields the publication with
    // an empty reading order rather than an error.
    const pages = komgaMediaProfile(source.primaryFile?.format) === 'DIVINA' ? await this.loadPageSources(user, bookId) : [];
    return { contentType: DIVINA_MANIFEST_CONTENT_TYPE, manifest: toKomgaDivinaManifest(source, pages, bookId) };
  }

  /** Komga serves every EPUB entry, not just the ones its manifest lists. */
  async streamResource(user: RequestUser, rawBookId: string, entryPath: string, reply: FastifyReply): Promise<void> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const source = await this.detailToSource(user, bookId);
    if (komgaMediaProfile(source.primaryFile?.format) !== 'EPUB') {
      throw new BadRequestException(`Book media type '${source.primaryFile?.format ?? 'unknown'}' is not compatible with the EPUB profile`);
    }

    const { stream, contentType, size } = await this.epubService.streamFile(bookId, entryPath, source.primaryFile?.id, user);
    reply.type(contentType);
    if (size > 0) reply.header('Content-Length', size);
    reply.header('Cache-Control', 'public, max-age=3600');
    reply.send(stream);
  }
}
