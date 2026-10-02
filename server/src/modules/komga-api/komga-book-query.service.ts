import { BadRequestException, Injectable } from '@nestjs/common';

import type { BookQuery, BooksPage, GroupRule, SortField, SortSpec } from '@bookorbit/types';
import { resolveTimeZone } from '../../common/utils/timezone.utils';
import type { RequestUser } from '../../common/types/request-user';
import { BookQueryBuilder } from '../book/book-query-builder.service';
import { BookService } from '../book/book.service';
import { LibraryService } from '../library/library.service';
import { ListSeriesBooksDto } from '../series/dto/list-series-books.dto';
import type { SeriesBookSort } from '../series/dto/list-series-books.dto';
import { ListSeriesDto } from '../series/dto/list-series.dto';
import type { SeriesListSort } from '../series/dto/list-series.dto';
import type { KomgaBookQueryDto } from './dto/komga-query.dto';
import { KomgaRepository } from './komga.repository';
import { resolveKomgaPagination } from './komga-ids';
import { KomgaConditionTranslator } from './komga-search-condition';

/** Unlisted sort tiers are dropped, not rejected; paging stays stable. */
const BOOK_SORT_FIELDS: Record<string, SortField> = {
  'metadata.title': 'title',
  'metadata.titleSort': 'title',
  title: 'title',
  'metadata.series': 'series',
  'metadata.seriesSort': 'series',
  series: 'series',
  seriesTitle: 'series',
  'metadata.number': 'seriesIndex',
  'metadata.numberSort': 'seriesIndex',
  number: 'seriesIndex',
  numberSort: 'seriesIndex',
  'metadata.releaseDate': 'publishedDate',
  releaseDate: 'publishedDate',
  'metadata.author': 'author',
  'metadata.authorSort': 'author',
  author: 'author',
  'metadata.publisher': 'publisher',
  publisher: 'publisher',
  'metadata.language': 'language',
  language: 'language',
  created: 'addedAt',
  createdDate: 'addedAt',
  lastModified: 'updatedAt',
  lastModifiedDate: 'updatedAt',
  size: 'fileSize',
  pagesCount: 'pageCount',
  mediaPagesCount: 'pageCount',
  readProgress: 'readProgress',
  readStatus: 'readStatus',
  lastReadDate: 'lastReadAt',
  'readProgress.lastModified': 'lastReadAt',
  'readProgress.readDate': 'lastReadAt',
};

const SERIES_SORT_FIELDS: Record<string, SeriesListSort> = {
  'metadata.title': 'name',
  'metadata.titleSort': 'name',
  title: 'name',
  name: 'name',
  booksCount: 'bookCount',
  created: 'lastAddedAt',
  createdDate: 'lastAddedAt',
  lastModified: 'lastAddedAt',
  lastModifiedDate: 'lastAddedAt',
  readProgress: 'readProgress',
};

const SERIES_BOOK_SORT_FIELDS: Record<string, SeriesBookSort> = {
  'metadata.number': 'seriesIndex',
  'metadata.numberSort': 'seriesIndex',
  number: 'seriesIndex',
  numberSort: 'seriesIndex',
  'metadata.title': 'title',
  'metadata.titleSort': 'title',
  title: 'title',
  created: 'addedAt',
  createdDate: 'addedAt',
};

const READ_STATUS_RULES: Record<string, { field: 'readProgress'; operator: 'isUnread' | 'isInProgress' | 'isFinished' }> = {
  UNREAD: { field: 'readProgress', operator: 'isUnread' },
  IN_PROGRESS: { field: 'readProgress', operator: 'isInProgress' },
  READ: { field: 'readProgress', operator: 'isFinished' },
};

const SERIES_READ_STATUS_COMPLETION: Record<string, 'not_started' | 'in_progress' | 'complete'> = {
  UNREAD: 'not_started',
  IN_PROGRESS: 'in_progress',
  READ: 'complete',
};

export interface KomgaBookSearch {
  page?: number;
  size?: number;
  unpaged?: boolean;
  sort?: string[];
  library_id?: number[];
  read_status?: string[];
  media_status?: string[];
  tag?: string[];
  author?: string[];
  deleted?: boolean;
  fullTextSearch?: string;
  condition?: unknown;
}

export interface KomgaSeriesSearch {
  page?: number;
  size?: number;
  unpaged?: boolean;
  sort?: string[];
  search?: string;
  library_id?: number[];
  read_status?: string[];
  author?: string[];
  q?: string;
  condition?: unknown;
}

interface BooksQueryRun {
  pagination: { page: number; size: number };
  sort: SortSpec[];
  filter?: GroupRule;
  q?: string;
  requestedLibraryIds?: number[];
  excludedLibraryIds?: number[];
}

@Injectable()
export class KomgaBookQueryService {
  constructor(
    private readonly queryBuilder: BookQueryBuilder,
    private readonly bookService: BookService,
    private readonly libraryService: LibraryService,
    private readonly repository: KomgaRepository,
  ) {}

  /** One translator per query keeps the resolved series names out of a shared cache. */
  private conditionTranslator(mode: 'books' | 'series'): KomgaConditionTranslator {
    return new KomgaConditionTranslator({ seriesNameById: (seriesId) => this.repository.findSeriesName(seriesId) }, mode);
  }

  private parseSort(sort: string[] | undefined, fields: Record<string, string>): { field: string; dir: 'asc' | 'desc' }[] {
    if (!sort) return [];
    const specs: { field: string; dir: 'asc' | 'desc' }[] = [];
    for (const entry of sort) {
      const [rawField, rawDir] = entry.split(',');
      const field = fields[rawField?.trim() ?? ''];
      if (!field) continue;
      specs.push({ field, dir: rawDir?.trim().toLowerCase() === 'desc' ? 'desc' : 'asc' });
    }
    return specs;
  }

  /** Unmappable flat filters are ignored, which can only widen a bounded result set. */
  private buildBookFilter(query: KomgaBookSearch, extraRules: GroupRule['rules'] = []): GroupRule | undefined {
    const rules: GroupRule['rules'] = [...extraRules];

    const readStatusRules = (query.read_status ?? [])
      .map((status) => READ_STATUS_RULES[status.toUpperCase()])
      .filter((rule): rule is NonNullable<typeof rule> => rule !== undefined);
    if (readStatusRules.length === 1) {
      rules.push({ type: 'rule', ...readStatusRules[0] });
    } else if (readStatusRules.length > 1) {
      rules.push({ type: 'group', join: 'OR', rules: readStatusRules.map((rule) => ({ type: 'rule', ...rule })) });
    }

    const availability = this.resolveAvailabilityRule(query);
    if (availability) rules.push(availability);

    if (query.tag && query.tag.length > 0) {
      rules.push({ type: 'rule', field: 'tag', operator: 'includesAny', value: query.tag });
    }
    if (query.author && query.author.length > 0) {
      rules.push({ type: 'rule', field: 'author', operator: 'includesAny', value: query.author });
    }

    if (rules.length === 0) return undefined;
    return { type: 'group', join: 'AND', rules };
  }

  private resolveAvailabilityRule(query: KomgaBookSearch): GroupRule['rules'][number] | undefined {
    const mediaStatuses = (query.media_status ?? []).map((status) => status.toUpperCase());
    const unsupported = mediaStatuses.find((status) => status !== 'READY' && status !== 'ERROR');
    if (unsupported) throw new BadRequestException(`media_status ${unsupported} is not supported`);

    const wantsMissing = mediaStatuses.includes('ERROR') || query.deleted === true;
    const wantsPresent = mediaStatuses.includes('READY') || query.deleted === false;
    if (wantsMissing && wantsPresent) {
      return {
        type: 'group',
        join: 'OR',
        rules: [
          { type: 'rule', field: 'fileAvailability', operator: 'isMissing' },
          { type: 'rule', field: 'fileAvailability', operator: 'isPresent' },
        ],
      };
    }
    if (wantsMissing) return { type: 'rule', field: 'fileAvailability', operator: 'isMissing' };
    if (wantsPresent) return { type: 'rule', field: 'fileAvailability', operator: 'isPresent' };
    return undefined;
  }

  private async runBooksQuery(user: RequestUser, run: BooksQueryRun): Promise<BooksPage> {
    const accessibleLibraryIds = await this.libraryService.findAccessibleLibraryIds(user);
    const requested = run.requestedLibraryIds;
    const withinRequested = requested?.length ? accessibleLibraryIds.filter((id) => requested.includes(id)) : accessibleLibraryIds;
    const excluded = run.excludedLibraryIds ?? [];
    const libraryIds = excluded.length > 0 ? withinRequested.filter((id) => !excluded.includes(id)) : withinRequested;

    const where = this.queryBuilder.buildWhere(run.filter, {
      accessibleLibraryIds: libraryIds,
      userId: user.id,
      q: run.q,
      timeZone: resolveTimeZone((user.settings as { timezone?: unknown } | undefined)?.timezone, 'UTC'),
      contentFilters: user.isSuperuser ? undefined : user.contentFilters,
    });

    const bookQuery: BookQuery = { sort: run.sort, pagination: run.pagination };
    return this.bookService.executeBooksQuery(user.id, where, bookQuery);
  }

  async queryBooks(user: RequestUser, query: KomgaBookSearch): Promise<BooksPage> {
    const condition = await this.conditionTranslator('books').translate(query.condition);
    const pagination = resolveKomgaPagination(query);
    if (condition.matchesNothing) return { items: [], total: 0, page: pagination.page, size: pagination.size };

    return this.runBooksQuery(user, {
      pagination,
      sort: this.parseSort(query.sort, BOOK_SORT_FIELDS) as SortSpec[],
      filter: this.buildBookFilter(query, condition.rules),
      q: query.fullTextSearch,
      requestedLibraryIds: query.library_id ?? condition.libraryInclude,
      excludedLibraryIds: condition.libraryExclude,
    });
  }

  async listLatest(user: RequestUser, query: KomgaBookSearch): Promise<BooksPage> {
    return this.runBooksQuery(user, {
      pagination: resolveKomgaPagination(query),
      sort: [{ field: 'addedAt', dir: 'desc' }],
      requestedLibraryIds: query.library_id,
    });
  }

  async listOnDeck(user: RequestUser, query: KomgaBookSearch): Promise<BooksPage> {
    return this.runBooksQuery(user, {
      pagination: resolveKomgaPagination(query),
      sort: [],
      filter: {
        type: 'group',
        join: 'AND',
        rules: [{ type: 'rule', field: 'seriesStatus', operator: 'isUpNext' }],
      },
      requestedLibraryIds: query.library_id,
    });
  }

  async toSeriesListDto(query: KomgaSeriesSearch): Promise<ListSeriesDto> {
    const pagination = resolveKomgaPagination(query);
    const dto = new ListSeriesDto();
    dto.page = pagination.page;
    dto.size = pagination.size;
    dto.q = query.search ?? query.q;

    const condition = await this.conditionTranslator('series').translate(query.condition);

    if (query.library_id && query.library_id.length > 1)
      throw new BadRequestException('filtering series by more than one library_id is not supported');
    const libraryId = query.library_id?.[0] ?? condition.libraryInclude?.[0];
    if (libraryId !== undefined) dto.libraryId = libraryId;

    const sort = this.parseSort(query.sort, SERIES_SORT_FIELDS)[0];
    if (sort) {
      dto.sort = sort.field as SeriesListSort;
      dto.order = sort.dir;
    }

    if (query.read_status && query.read_status.length > 1)
      throw new BadRequestException('filtering series by more than one read_status is not supported');
    const readStatus = query.read_status?.[0];
    const completionStatus = readStatus ? SERIES_READ_STATUS_COMPLETION[readStatus.toUpperCase()] : undefined;
    if (completionStatus) dto.completionStatus = completionStatus;
    else if (condition.completions?.length === 1) dto.completionStatus = condition.completions[0];

    return dto;
  }

  toSeriesBooksDto(query: KomgaBookQueryDto): ListSeriesBooksDto {
    const pagination = resolveKomgaPagination(query);
    const dto = new ListSeriesBooksDto();
    dto.page = pagination.page;
    dto.size = pagination.size;

    const sort = this.parseSort(query.sort, SERIES_BOOK_SORT_FIELDS)[0];
    if (sort) {
      dto.sort = sort.field as SeriesBookSort;
      dto.order = sort.dir;
    }

    return dto;
  }
}
