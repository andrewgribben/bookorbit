import { BadRequestException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestUser } from '../../common/types/request-user';
import { BookMergeService } from './book-merge.service';

vi.mock('../book-move/book-move.utils', () => ({
  buildSuppressionPaths: vi.fn().mockReturnValue(['/suppress']),
  moveFile: vi.fn().mockResolvedValue(undefined),
  moveFileBack: vi.fn().mockResolvedValue(undefined),
  pathExists: vi.fn((path: string) => Promise.resolve(path.includes('/Source/'))),
  removeEmptyDirs: vi.fn().mockResolvedValue(undefined),
  withCollisionSuffix: vi.fn((path: string) => path),
}));

vi.mock('fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ ino: 1n, size: 10n, mtimeMs: Date.now() }),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

const USER: RequestUser = { id: 7, username: 'reader', isSuperuser: false } as RequestUser;

describe('BookMergeService', () => {
  let db: {
    select: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let libraryService: { verifyUserAccess: ReturnType<typeof vi.fn> };
  let lockService: { withLock: ReturnType<typeof vi.fn> };
  let selfWriteRegistry: { begin: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  let coverStore: {
    removeCoverDirectory: ReturnType<typeof vi.fn>;
    slotsForAdoption: ReturnType<typeof vi.fn>;
    adoptSlots: ReturnType<typeof vi.fn>;
  };
  let coverReconciler: { enqueue: ReturnType<typeof vi.fn> };
  let service: BookMergeService;

  beforeEach(() => {
    db = {
      select: vi.fn(),
      transaction: vi.fn(),
    };
    libraryService = { verifyUserAccess: vi.fn().mockResolvedValue(undefined) };
    lockService = {
      withLock: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
    };
    selfWriteRegistry = { begin: vi.fn(), end: vi.fn() };
    coverStore = {
      removeCoverDirectory: vi.fn().mockResolvedValue(undefined),
      slotsForAdoption: vi.fn().mockResolvedValue([]),
      adoptSlots: vi.fn().mockResolvedValue([]),
    };
    coverReconciler = { enqueue: vi.fn().mockResolvedValue(undefined) };
    service = new BookMergeService(
      db as never,
      libraryService as never,
      lockService as never,
      selfWriteRegistry as never,
      coverStore as never,
      coverReconciler as never,
    );
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

  it('hands source cover slots to the target before removing the source cover directory', async () => {
    const sourceSlots = [{ bookId: 2, medium: 'ebook', source: 'extracted' }];
    coverStore.slotsForAdoption.mockResolvedValue(sourceSlots);
    coverStore.adoptSlots.mockResolvedValue(['ebook']);

    const booksChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        {
          id: 1,
          libraryId: 9,
          libraryFolderId: 3,
          folderPath: '/lib/Keep',
          primaryFileId: 10,
          status: 'present',
          organizationMode: 'book_per_folder',
          formatPriority: ['epub', 'm4b'],
          libraryFolderPath: '/lib',
          title: 'Keep',
        },
        {
          id: 2,
          libraryId: 9,
          libraryFolderId: 3,
          folderPath: '/lib/Source',
          primaryFileId: 11,
          status: 'present',
          organizationMode: 'book_per_folder',
          formatPriority: ['epub', 'm4b'],
          libraryFolderPath: '/lib',
          title: 'Source',
        },
      ]),
    };
    const contentFilesChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([
        {
          id: 11,
          bookId: 2,
          absolutePath: '/lib/Source/book.epub',
          format: 'epub',
          role: 'content',
          sizeBytes: 10,
          mediaOverlayAvailable: false,
        },
      ]),
    };
    const existingTargetFilesChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ absolutePath: '/lib/Keep/book.m4b' }]),
    };
    db.select.mockReturnValueOnce(booksChain).mockReturnValueOnce(contentFilesChain).mockReturnValueOnce(existingTargetFilesChain);

    let selectCalls = 0;
    const tx = {
      select: vi.fn().mockImplementation(() => {
        selectCalls += 1;
        if (selectCalls === 1) {
          return {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            for: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue([{ id: 1, primaryFileId: 10, status: 'present', formatPriority: ['epub', 'm4b'] }]),
          };
        }
        if (selectCalls === 2) {
          return {
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue([]),
          };
        }
        return {
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockResolvedValue([
            { id: 10, format: 'm4b', sizeBytes: 20, mediaOverlayAvailable: false },
            { id: 11, format: 'epub', sizeBytes: 10, mediaOverlayAvailable: false },
          ]),
        };
      }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined) }) }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    };
    db.transaction.mockImplementation(((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)) as never);

    await expect(service.mergeBooks(1, [2], USER)).resolves.toEqual({
      targetBookId: 1,
      mergedSourceBookIds: [2],
      movedFileCount: 1,
    });

    expect(coverStore.slotsForAdoption).toHaveBeenCalledWith(2);
    expect(coverStore.adoptSlots).toHaveBeenCalledWith(2, sourceSlots, 1);
    expect(coverStore.removeCoverDirectory).toHaveBeenCalledWith(2);
    expect(coverReconciler.enqueue).toHaveBeenCalledWith([1], { filesChanged: true });
    expect(coverStore.slotsForAdoption.mock.invocationCallOrder[0]).toBeLessThan(coverStore.adoptSlots.mock.invocationCallOrder[0]!);
    expect(coverStore.adoptSlots.mock.invocationCallOrder[0]).toBeLessThan(coverStore.removeCoverDirectory.mock.invocationCallOrder[0]!);
  });
});
