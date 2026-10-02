import { Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import type { SeriesSummary } from '@bookorbit/types';
import type { RequestUser } from '../../common/types/request-user';
import { SeriesService } from '../series/series.service';
import { LibraryService } from '../library/library.service';
import { BookService } from '../book/book.service';
import type { KomgaCollection, KomgaPage, KomgaSeries } from './komga-api.types';
import { decodeKomgaId, komgaNotFound, toKomgaPage } from './komga-ids';
import { toKomgaSeries } from './komga.mappers';
import type { KomgaSeriesSearch } from './komga-book-query.service';
import { KomgaBookQueryService } from './komga-book-query.service';
import { KomgaBookService } from './komga-book.service';
import { KomgaCollectionService } from './komga-collection.service';
import { KomgaRepository } from './komga.repository';

@Injectable()
export class KomgaSeriesService {
  constructor(
    private readonly seriesService: SeriesService,
    private readonly bookService: BookService,
    private readonly libraryService: LibraryService,
    private readonly repo: KomgaRepository,
    private readonly queryService: KomgaBookQueryService,
    private readonly komgaBookService: KomgaBookService,
    private readonly collectionService: KomgaCollectionService,
  ) {}

  private contentFilters(user: RequestUser) {
    return user.isSuperuser ? undefined : user.contentFilters;
  }

  private summaryToSeries(summary: SeriesSummary, fact: { createdAt: Date; updatedAt: Date; libraryId: number | null } | undefined): KomgaSeries {
    return toKomgaSeries({
      id: summary.id,
      name: summary.name,
      libraryId: fact?.libraryId ?? null,
      createdAt: fact?.createdAt.toISOString() ?? null,
      updatedAt: fact?.updatedAt.toISOString() ?? null,
      lastAddedAt: summary.lastAddedAt,
      bookCount: summary.bookCount,
      readCount: summary.readCount,
      readingCount: summary.readingCount,
      expectedBookCount: summary.expectedBookCount,
      authors: summary.authors,
    });
  }

  async listSeries(user: RequestUser, query: KomgaSeriesSearch): Promise<KomgaPage<KomgaSeries>> {
    const dto = await this.queryService.toSeriesListDto(query);
    const page = await this.seriesService.findAll(user, dto);
    const facts = await this.repo.findSeriesFacts(page.items.map((item) => item.id));
    const factById = new Map(facts.map((fact) => [fact.seriesId, fact]));

    return toKomgaPage(
      page.items.map((item) => this.summaryToSeries(item, factById.get(item.id))),
      page.total,
      page.page,
      page.size,
      true,
      query.unpaged === true,
    );
  }

  async listLatest(user: RequestUser, query: KomgaSeriesSearch): Promise<KomgaPage<KomgaSeries>> {
    const dto = await this.queryService.toSeriesListDto(query);
    dto.sort = 'lastAddedAt';
    dto.order = 'desc';
    const page = await this.seriesService.findAll(user, dto);
    const facts = await this.repo.findSeriesFacts(page.items.map((item) => item.id));
    const factById = new Map(facts.map((fact) => [fact.seriesId, fact]));

    return toKomgaPage(
      page.items.map((item) => this.summaryToSeries(item, factById.get(item.id))),
      page.total,
      page.page,
      page.size,
      true,
      query.unpaged === true,
    );
  }

  async getSeries(user: RequestUser, rawSeriesId: string): Promise<KomgaSeries> {
    const seriesId = decodeKomgaId(rawSeriesId, 'series');
    const libraryIds = await this.libraryService.findAccessibleLibraryIds(user);
    const filter = this.contentFilters(user);

    const [fact, authors] = await Promise.all([
      this.repo.findSeriesDetailFact({ seriesId, userId: user.id, libraryIds, contentFilters: filter }),
      this.repo.findSeriesAuthors({ seriesId, libraryIds, contentFilters: filter }),
    ]);
    if (!fact) throw komgaNotFound('series', seriesId);

    return toKomgaSeries({
      id: fact.seriesId,
      name: fact.name,
      libraryId: fact.libraryId,
      createdAt: fact.createdAt.toISOString(),
      updatedAt: fact.updatedAt.toISOString(),
      lastAddedAt: null,
      bookCount: fact.bookCount,
      readCount: fact.readCount,
      readingCount: fact.readingCount,
      expectedBookCount: fact.expectedBookCount,
      authors,
    });
  }

  async streamThumbnail(user: RequestUser, rawSeriesId: string, reply: FastifyReply): Promise<void> {
    const seriesId = decodeKomgaId(rawSeriesId, 'series');
    const page = await this.seriesService.findBooks(user, seriesId, { page: 0, size: 1, sort: 'seriesIndex', order: 'asc' });
    const book = page.items[0];
    if (!book) throw komgaNotFound('series', seriesId);

    await this.komgaBookService.streamCover(user, book.id, reply);
  }

  async listCollectionsForSeries(user: RequestUser, rawSeriesId: string): Promise<KomgaCollection[]> {
    const seriesId = decodeKomgaId(rawSeriesId, 'series');
    return this.collectionService.listCollectionsForSeries(user, seriesId);
  }

  async setSeriesReadProgress(user: RequestUser, rawSeriesId: string): Promise<void> {
    const seriesId = decodeKomgaId(rawSeriesId, 'series');
    const libraryIds = await this.libraryService.findAccessibleLibraryIds(user);
    const bookIds = await this.repo.findSeriesBookIds({ seriesId, libraryIds, contentFilters: this.contentFilters(user) });
    if (bookIds.length === 0) throw komgaNotFound('series', seriesId);

    await this.bookService.bulkSetStatus(bookIds, 'read', user);
  }

  /** Clears read status only; leaves per-file positions. */
  async clearSeriesReadProgress(user: RequestUser, rawSeriesId: string): Promise<void> {
    const seriesId = decodeKomgaId(rawSeriesId, 'series');
    const libraryIds = await this.libraryService.findAccessibleLibraryIds(user);
    const bookIds = await this.repo.findSeriesBookIds({ seriesId, libraryIds, contentFilters: this.contentFilters(user) });
    if (bookIds.length === 0) throw komgaNotFound('series', seriesId);

    await this.bookService.bulkSetStatus(bookIds, 'unread', user);
  }
}
