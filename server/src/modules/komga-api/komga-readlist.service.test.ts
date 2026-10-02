import { BadRequestException } from '@nestjs/common';

import { EMPTY_CONTENT_FILTER_RULES } from '@bookorbit/types';
import type { RequestUser } from '../../common/types/request-user';
import { KomgaReadListService } from './komga-readlist.service';

function requestUser(overrides: Partial<RequestUser> = {}): RequestUser {
  return {
    id: 7,
    isSuperuser: false,
    settings: {},
    contentFilters: EMPTY_CONTENT_FILTER_RULES,
    ...overrides,
  } as unknown as RequestUser;
}

function collectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 44,
    userId: 7,
    name: 'Crisis order',
    icon: 'Bookmark',
    description: 'Read these in order',
    isPublic: false,
    isOwner: true,
    syncToKobo: false,
    displayOrder: 0,
    bookCount: 3,
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-04T09:00:00.000Z',
    ...overrides,
  };
}

describe('KomgaReadListService', () => {
  const collectionService = {
    findAll: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    addBooks: vi.fn(),
    removeBooks: vi.fn(),
    getBooks: vi.fn(),
  };
  const libraryService = { findAccessibleLibraryIds: vi.fn().mockResolvedValue([1]) };
  const repo = { findBookIdsByCollections: vi.fn(), findReadableCollectionsForBook: vi.fn() };
  const komgaBookService = { toKomgaBooks: vi.fn(), streamCover: vi.fn() };

  const service = new KomgaReadListService(collectionService as never, libraryService as never, repo as never, komgaBookService as never);

  beforeEach(() => {
    vi.resetAllMocks();
    libraryService.findAccessibleLibraryIds.mockResolvedValue([1]);
    collectionService.findAll.mockResolvedValue([collectionRow()]);
    collectionService.findOne.mockResolvedValue(collectionRow());
    repo.findBookIdsByCollections.mockResolvedValue([
      { collectionId: 44, bookId: 1288 },
      { collectionId: 44, bookId: 1287 },
    ]);
  });

  it('lists readlists with their books in membership order', async () => {
    const page = await service.listReadLists(requestUser(), { page: 0, size: 20 });

    expect(page.content).toHaveLength(1);
    expect(page.content[0].bookIds).toEqual(['1288', '1287']);
    expect(page.content[0].summary).toBe('Read these in order');
    expect(page.content[0].filtered).toBe(false);
    expect(page.totalElements).toBe(1);
    expect(page.pageable.pageSize).toBe(20);
  });

  it('scopes the membership query to the libraries and filters the user may see', async () => {
    await service.listReadLists(requestUser(), {});

    expect(repo.findBookIdsByCollections).toHaveBeenCalledWith([44], [1], EMPTY_CONTENT_FILTER_RULES);
  });

  it('skips the content filters for a superuser', async () => {
    await service.listReadLists(requestUser({ isSuperuser: true }), {});

    expect(repo.findBookIdsByCollections).toHaveBeenCalledWith([44], [1], undefined);
  });

  it('filters by search over collection names', async () => {
    const page = await service.listReadLists(requestUser(), { search: 'crisis' });
    expect(page.totalElements).toBe(1);
    expect(page.content).toHaveLength(1);

    const empty = await service.listReadLists(requestUser(), { search: 'nothing matches' });
    expect(empty.content).toEqual([]);
    expect(empty.totalElements).toBe(0);
  });

  it('pages over the collections instead of returning all of them', async () => {
    collectionService.findAll.mockResolvedValue([collectionRow({ id: 1 }), collectionRow({ id: 2 }), collectionRow({ id: 3 })]);

    const page = await service.listReadLists(requestUser(), { page: 1, size: 2 });

    expect(page.content.map((entry) => entry.id)).toEqual(['3']);
    expect(page.totalElements).toBe(3);
    expect(page.totalPages).toBe(2);
  });

  it('creates a readlist as a BookOrbit collection and adds its books', async () => {
    collectionService.create.mockResolvedValue(collectionRow());
    collectionService.addBooks.mockResolvedValue(collectionRow());

    const created = await service.createReadList(requestUser(), {
      name: 'Crisis order',
      summary: 'Read these in order',
      bookIds: ['1288', '1287'],
    });

    expect(collectionService.create).toHaveBeenCalledWith(
      { name: 'Crisis order', icon: 'Bookmark', description: 'Read these in order' },
      expect.anything(),
    );
    expect(collectionService.addBooks).toHaveBeenCalledWith(44, { bookIds: [1288, 1287] }, expect.anything());
    expect(created.bookIds).toEqual(['1288', '1287']);
  });

  it('creates an empty readlist without a membership write', async () => {
    collectionService.create.mockResolvedValue(collectionRow());

    await service.createReadList(requestUser(), { name: 'Empty' });

    expect(collectionService.addBooks).not.toHaveBeenCalled();
  });

  it('replaces membership on update rather than appending to it', async () => {
    await service.updateReadList(requestUser(), '44', { bookIds: ['1290'] });

    expect(collectionService.removeBooks).toHaveBeenCalledWith(44, { bookIds: [1288, 1287] }, expect.anything());
    expect(collectionService.addBooks).toHaveBeenCalledWith(44, { bookIds: [1290] }, expect.anything());
  });

  it('updates name and summary without touching membership', async () => {
    await service.updateReadList(requestUser(), '44', { name: 'Renamed', summary: 'New summary' });

    expect(collectionService.update).toHaveBeenCalledWith(44, { name: 'Renamed', description: 'New summary' }, expect.anything());
    expect(collectionService.removeBooks).not.toHaveBeenCalled();
    expect(collectionService.addBooks).not.toHaveBeenCalled();
  });

  it('deletes the underlying collection', async () => {
    await service.deleteReadList(requestUser(), '44');

    expect(collectionService.remove).toHaveBeenCalledWith(44, expect.anything());
  });

  it('rejects a readlist id that cannot name a row', async () => {
    await expect(service.getReadList(requestUser(), 'not-an-id')).rejects.toThrow(BadRequestException);
    await expect(service.deleteReadList(requestUser(), '0')).rejects.toThrow(BadRequestException);
  });

  it('maps readlist books through the book service and keeps Komga paging', async () => {
    collectionService.getBooks.mockResolvedValue({ items: [{ id: 1 }], total: 3, page: 1, size: 1 });
    komgaBookService.toKomgaBooks.mockResolvedValue([{ id: '1' }]);

    const page = await service.listBooks(requestUser(), '44', { page: 1, size: 1 });

    expect(collectionService.getBooks).toHaveBeenCalledWith(44, expect.anything(), 1, 1);
    expect(page.content).toEqual([{ id: '1' }]);
    expect(page.totalElements).toBe(3);
    expect(page.number).toBe(1);
  });

  it('reports the readlists holding one book', async () => {
    repo.findReadableCollectionsForBook.mockResolvedValue([
      {
        id: 44,
        name: 'Crisis order',
        description: null,
        createdAt: new Date('2026-09-02T09:00:00.000Z'),
        updatedAt: new Date('2026-09-04T09:00:00.000Z'),
      },
    ]);

    const lists = await service.listReadListsForBook(requestUser(), '1287');

    expect(repo.findReadableCollectionsForBook).toHaveBeenCalledWith(7, 1287);
    expect(lists).toHaveLength(1);
    expect(lists[0].id).toBe('44');
    expect(lists[0].summary).toBe('');
    expect(lists[0].createdDate).toBe('2026-09-02T09:00:00.000Z');
    expect(lists[0].bookIds).toEqual(['1288', '1287']);
  });
});
