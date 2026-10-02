import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestUser } from '../../common/types/request-user';
import { BookMergeService } from './book-merge.service';

const USER: RequestUser = { id: 7, username: 'reader', isSuperuser: false } as RequestUser;

describe('BookMergeService', () => {
  let db: {
    select: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let libraryService: { verifyUserAccess: ReturnType<typeof vi.fn> };
  let lockService: { withLock: ReturnType<typeof vi.fn> };
  let selfWriteRegistry: { begin: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  let coverStore: { removeCoverDirectory: ReturnType<typeof vi.fn> };
  let service: BookMergeService;

  beforeEach(() => {
    db = {
      select: vi.fn(),
      transaction: vi.fn(),
    };
    libraryService = { verifyUserAccess: vi.fn().mockResolvedValue(undefined) };
    lockService = {
      withLock: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
    };
    selfWriteRegistry = { begin: vi.fn(), end: vi.fn() };
    coverStore = { removeCoverDirectory: vi.fn().mockResolvedValue(undefined) };
    service = new BookMergeService(db as never, libraryService as never, lockService as never, selfWriteRegistry as never, coverStore as never);
  });

  it('rejects an empty source list', async () => {
    await expect(service.mergeBooks(1, [], USER)).rejects.toBeInstanceOf(BadRequestException);
    expect(lockService.withLock).not.toHaveBeenCalled();
  });

  it('rejects merging a book into itself when that is the only id', async () => {
    await expect(service.mergeBooks(1, [1], USER)).rejects.toBeInstanceOf(BadRequestException);
    expect(lockService.withLock).not.toHaveBeenCalled();
  });

  it('rejects when the target book is missing', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    db.select.mockReturnValue(chain);

    await expect(service.mergeBooks(1, [2], USER)).rejects.toBeInstanceOf(NotFoundException);
    expect(libraryService.verifyUserAccess).not.toHaveBeenCalled();
  });

  it('rejects File as Book libraries', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          id: 1,
          libraryId: 9,
          libraryFolderId: 3,
          folderPath: '/lib/a',
          primaryFileId: 10,
          status: 'present',
          organizationMode: 'book_per_file',
          formatPriority: ['epub'],
          libraryFolderPath: '/lib',
          title: 'Keep',
        },
        {
          id: 2,
          libraryId: 9,
          libraryFolderId: 3,
          folderPath: '/lib/b',
          primaryFileId: 11,
          status: 'present',
          organizationMode: 'book_per_file',
          formatPriority: ['epub'],
          libraryFolderPath: '/lib',
          title: 'Merge',
        },
      ]),
    };
    db.select.mockReturnValue(chain);

    await expect(service.mergeBooks(1, [2], USER)).rejects.toThrow(/Folder as Book/);
    expect(libraryService.verifyUserAccess).toHaveBeenCalledWith(USER.id, 9, false);
  });

  it('allows merge across different library folder roots in the same library', async () => {
    const booksChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          id: 1,
          libraryId: 9,
          libraryFolderId: 3,
          folderPath: '/ebooks/Keep',
          primaryFileId: 10,
          status: 'present',
          organizationMode: 'book_per_folder',
          formatPriority: ['epub', 'm4b'],
          libraryFolderPath: '/ebooks',
          title: 'Keep',
        },
        {
          id: 2,
          libraryId: 9,
          libraryFolderId: 4,
          folderPath: '/audiobooks/Merge',
          primaryFileId: 11,
          status: 'present',
          organizationMode: 'book_per_folder',
          formatPriority: ['epub', 'm4b'],
          libraryFolderPath: '/audiobooks',
          title: 'Merge',
        },
      ]),
    };
    const filesChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    };
    db.select.mockReturnValueOnce(booksChain).mockReturnValueOnce(filesChain);

    await expect(service.mergeBooks(1, [2], USER)).rejects.toThrow(/no content files/);
    expect(libraryService.verifyUserAccess).toHaveBeenCalledWith(USER.id, 9, false);
  });
});
