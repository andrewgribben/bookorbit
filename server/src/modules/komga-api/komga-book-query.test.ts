import { BadRequestException } from '@nestjs/common';

import { EMPTY_CONTENT_FILTER_RULES } from '@bookorbit/types';
import type { RequestUser } from '../../common/types/request-user';
import { KomgaBookQueryService } from './komga-book-query.service';

const WHERE_SENTINEL = { where: 'sentinel' } as never;

function requestUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 7,
    isSuperuser: false,
    settings: {},
    contentFilters: EMPTY_CONTENT_FILTER_RULES,
    ...overrides,
  } as unknown as RequestUser;
}

describe('Komga book search translation', () => {
  const queryBuilder = { buildWhere: vi.fn().mockReturnValue(WHERE_SENTINEL) };
  const bookService = { executeBooksQuery: vi.fn().mockResolvedValue({ items: [], total: 0, page: 0, size: 20 }) };
  const libraryService = { findAccessibleLibraryIds: vi.fn().mockResolvedValue([1, 2]) };
  const repository = { findSeriesName: vi.fn().mockResolvedValue('Robert Langdon') };

  const service = new KomgaBookQueryService(queryBuilder as never, bookService as never, libraryService as never, repository as never);

  beforeEach(() => {
    vi.clearAllMocks();
    queryBuilder.buildWhere.mockReturnValue(WHERE_SENTINEL);
    bookService.executeBooksQuery.mockResolvedValue({ items: [], total: 0, page: 0, size: 20 });
    libraryService.findAccessibleLibraryIds.mockResolvedValue([1, 2]);
  });

  it('passes full text search, paging and mapped sort through to BookOrbit', async () => {
    await service.queryBooks(requestUser(), { fullTextSearch: 'batman', page: 2, size: 25, sort: ['metadata.titleSort,desc', 'unknownField,asc'] });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(undefined, {
      accessibleLibraryIds: [1, 2],
      userId: 7,
      q: 'batman',
      timeZone: 'UTC',
      contentFilters: EMPTY_CONTENT_FILTER_RULES,
    });
    // An unmapped sort tier is dropped rather than rejected, so the page stays valid.
    expect(bookService.executeBooksQuery).toHaveBeenCalledWith(7, WHERE_SENTINEL, {
      sort: [{ field: 'title', dir: 'desc' }],
      pagination: { page: 2, size: 25 },
    });
  });

  it('narrows to the requested libraries that the user may actually see', async () => {
    await service.queryBooks(requestUser(), { library_id: [2, 99] });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(undefined, expect.objectContaining({ accessibleLibraryIds: [2] }));
  });

  it('turns a whole-library skip for an inaccessible library', async () => {
    await service.queryBooks(requestUser(), { library_id: [99] });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(undefined, expect.objectContaining({ accessibleLibraryIds: [] }));
  });

  it('translates a single read status into a progress rule', async () => {
    await service.queryBooks(requestUser(), { read_status: ['READ'] });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      { type: 'group', join: 'AND', rules: [{ type: 'rule', field: 'readProgress', operator: 'isFinished' }] },
      expect.anything(),
    );
  });

  it('translates several read statuses into one OR group', async () => {
    await service.queryBooks(requestUser(), { read_status: ['READ', 'UNREAD'] });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      {
        type: 'group',
        join: 'AND',
        rules: [
          {
            type: 'group',
            join: 'OR',
            rules: [
              { type: 'rule', field: 'readProgress', operator: 'isFinished' },
              { type: 'rule', field: 'readProgress', operator: 'isUnread' },
            ],
          },
        ],
      },
      expect.anything(),
    );
  });

  it('maps media status and the deleted flag onto file availability', async () => {
    await service.queryBooks(requestUser(), { media_status: ['ERROR'] });
    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      { type: 'group', join: 'AND', rules: [{ type: 'rule', field: 'fileAvailability', operator: 'isMissing' }] },
      expect.anything(),
    );

    vi.clearAllMocks();
    queryBuilder.buildWhere.mockReturnValue(WHERE_SENTINEL);
    await service.queryBooks(requestUser(), { deleted: false });
    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      { type: 'group', join: 'AND', rules: [{ type: 'rule', field: 'fileAvailability', operator: 'isPresent' }] },
      expect.anything(),
    );
  });

  it('asks for present or missing books when the filter wants both', async () => {
    await service.queryBooks(requestUser(), { media_status: ['READY', 'ERROR'] });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      {
        type: 'group',
        join: 'AND',
        rules: [
          {
            type: 'group',
            join: 'OR',
            rules: [
              { type: 'rule', field: 'fileAvailability', operator: 'isMissing' },
              { type: 'rule', field: 'fileAvailability', operator: 'isPresent' },
            ],
          },
        ],
      },
      expect.anything(),
    );
  });

  it('rejects a media status BookOrbit cannot map instead of ignoring it', async () => {
    await expect(service.queryBooks(requestUser(), { media_status: ['UNKNOWN'] })).rejects.toThrow(BadRequestException);
  });

  it('maps tags and authors onto BookOrbit text rules', async () => {
    await service.queryBooks(requestUser(), { tag: ['batman'], author: ['Miller'] });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      {
        type: 'group',
        join: 'AND',
        rules: [
          { type: 'rule', field: 'tag', operator: 'includesAny', value: ['batman'] },
          { type: 'rule', field: 'author', operator: 'includesAny', value: ['Miller'] },
        ],
      },
      expect.anything(),
    );
  });

  it('answers a bare read status clause instead of rejecting the tree', async () => {
    await service.queryBooks(requestUser(), { condition: { readStatus: { operator: 'is', value: 'READ' } } });
    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      { type: 'group', join: 'AND', rules: [{ type: 'rule', field: 'readProgress', operator: 'isFinished' }] },
      expect.anything(),
    );
  });

  it('combines allOf clauses and library scoping from one tree', async () => {
    await service.queryBooks(requestUser(), {
      condition: {
        allOf: [{ libraryId: { operator: 'is', value: '2' } }, { anyOf: [{ readStatus: { operator: 'is', value: 'IN_PROGRESS' } }] }],
      },
    });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      { type: 'group', join: 'AND', rules: [{ type: 'rule', field: 'readProgress', operator: 'isInProgress' }] },
      expect.objectContaining({ accessibleLibraryIds: [2] }),
    );
  });

  it('excludes libraries and read statuses a client asks to hide', async () => {
    await service.queryBooks(requestUser(), {
      condition: { allOf: [{ libraryId: { operator: 'isNot', value: '1' } }, { readStatus: { operator: 'isNot', value: 'UNREAD' } }] },
    });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      {
        type: 'group',
        join: 'AND',
        rules: [
          { type: 'rule', field: 'readProgress', operator: 'isInProgress' },
          { type: 'rule', field: 'readProgress', operator: 'isFinished' },
        ],
      },
      expect.objectContaining({ accessibleLibraryIds: [2] }),
    );
  });

  it('resolves a series id clause through the series table', async () => {
    await service.queryBooks(requestUser(), { condition: { seriesId: { operator: 'is', value: '1' } } });
    expect(repository.findSeriesName).toHaveBeenCalledWith(1);
    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      { type: 'group', join: 'AND', rules: [{ type: 'rule', field: 'series', operator: 'eq', value: 'Robert Langdon' }] },
      expect.anything(),
    );
  });

  it('maps one-shot, deleted and metadata clauses Komga clients send', async () => {
    await service.queryBooks(requestUser(), {
      condition: {
        allOf: [
          { oneshot: { operator: 'isfalse' } },
          { deleted: { operator: 'isfalse' } },
          { tag: { operator: 'is', value: 'thriller' } },
          { author: { operator: 'is', value: { name: 'Dan Brown' } } },
          { releaseDate: { operator: 'after', dateTime: '2000-01-01T00:00:00Z' } },
        ],
      },
    });

    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      {
        type: 'group',
        join: 'AND',
        rules: [
          { type: 'rule', field: 'series', operator: 'isNotEmpty' },
          { type: 'rule', field: 'fileAvailability', operator: 'isPresent' },
          { type: 'rule', field: 'tag', operator: 'includesAny', value: ['thriller'] },
          { type: 'rule', field: 'author', operator: 'includesAny', value: ['Dan Brown'] },
          { type: 'rule', field: 'publishedDate', operator: 'after', value: '2000-01-01T00:00:00Z' },
        ],
      },
      expect.anything(),
    );
  });

  it('rejects a condition shape that is not a Komga tree', async () => {
    await expect(service.queryBooks(requestUser(), { condition: { allOf: [] } })).rejects.toThrow(BadRequestException);
    await expect(service.queryBooks(requestUser(), { condition: 'unread' })).rejects.toThrow(BadRequestException);
    await expect(service.queryBooks(requestUser(), { condition: { title: {}, tag: {} } })).rejects.toThrow(BadRequestException);
  });

  it('caps unpaged requests silently', async () => {
    await expect(service.queryBooks(requestUser(), { unpaged: true })).resolves.toBeDefined();
  });

  it('sorts latest by added date and on-deck by the up-next rule', async () => {
    await service.listLatest(requestUser(), {});
    expect(bookService.executeBooksQuery).toHaveBeenCalledWith(7, WHERE_SENTINEL, {
      sort: [{ field: 'addedAt', dir: 'desc' }],
      pagination: { page: 0, size: 20 },
    });

    vi.clearAllMocks();
    queryBuilder.buildWhere.mockReturnValue(WHERE_SENTINEL);
    bookService.executeBooksQuery.mockResolvedValue({ items: [], total: 0, page: 0, size: 20 });
    await service.listOnDeck(requestUser(), {});
    expect(queryBuilder.buildWhere).toHaveBeenCalledWith(
      { type: 'group', join: 'AND', rules: [{ type: 'rule', field: 'seriesStatus', operator: 'isUpNext' }] },
      expect.anything(),
    );
  });
});

describe('Komga series query translation', () => {
  const repository = { findSeriesName: vi.fn().mockResolvedValue('Robert Langdon') };
  const service = new KomgaBookQueryService({} as never, {} as never, {} as never, repository as never);

  it('maps paging, search, sort and read status onto the BookOrbit series DTO', async () => {
    const dto = await service.toSeriesListDto({
      page: 1,
      size: 10,
      search: 'bat',
      sort: ['booksCount,desc'],
      read_status: ['IN_PROGRESS'],
      library_id: [3],
    });

    expect(dto.page).toBe(1);
    expect(dto.size).toBe(10);
    expect(dto.q).toBe('bat');
    expect(dto.sort).toBe('bookCount');
    expect(dto.order).toBe('desc');
    expect(dto.completionStatus).toBe('in_progress');
    expect(dto.libraryId).toBe(3);
  });

  it('takes library and completion scoping from a condition tree', async () => {
    const dto = await service.toSeriesListDto({
      condition: { allOf: [{ libraryId: { operator: 'is', value: '2' } }, { complete: { operator: 'isfalse' } }] },
    });

    expect(dto.libraryId).toBe(2);
    expect(dto.completionStatus).toBeUndefined();
  });

  it('refuses multi-value filters the series query cannot express', async () => {
    await expect(service.toSeriesListDto({ library_id: [1, 2] })).rejects.toThrow(BadRequestException);
    await expect(service.toSeriesListDto({ read_status: ['READ', 'UNREAD'] })).rejects.toThrow(BadRequestException);
  });

  it('maps the sort vocabulary inside one series', () => {
    expect(service.toSeriesBooksDto({ sort: ['metadata.numberSort,desc'], size: 5 })).toMatchObject({
      sort: 'seriesIndex',
      order: 'desc',
      size: 5,
      page: 0,
    });
  });
});
