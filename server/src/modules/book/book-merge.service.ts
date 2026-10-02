import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { basename, dirname, extname, join, relative } from 'path';
import { readdir, stat, unlink } from 'fs/promises';
import type { BookMergeResult } from '@bookorbit/types';

import { DB } from '../../db/db.module';
import * as schema from '../../db/schema';
import { bookFiles, books, collectionBooks, libraries, libraryFolders } from '../../db/schema';
import type { RequestUser } from '../../common/types/request-user';
import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { selectPrimaryFileKeepingCurrent } from '../../common/utils/primary-file-selection.utils';
import { SelfWriteRegistry } from '../../common/services/self-write-registry.service';
import { BookCoverStore } from '../book-cover-store/book-cover-store.service';
import { FileLockService, bookOperationLockKey } from '../file-write/file-lock.service';
import { LibraryService } from '../library/library.service';
import { buildSuppressionPaths, moveFile, moveFileBack, pathExists, removeEmptyDirs, withCollisionSuffix } from '../book-move/book-move.utils';

type Db = NodePgDatabase<typeof schema>;

const EVENT = 'book.merge';
const CONTENT_ROLE = 'content';
const MAX_COLLISION_ATTEMPTS = 50;
const SIDECAR_COVER_NAMES = new Set(['cover', 'folder', 'thumbnail', 'artwork', 'front']);
const SIDECAR_COVER_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

type MergeBookRow = {
  id: number;
  libraryId: number;
  libraryFolderId: number;
  folderPath: string;
  primaryFileId: number | null;
  status: string;
  organizationMode: string;
  formatPriority: string[] | null;
  libraryFolderPath: string;
  title: string | null;
};

type MergeFileRow = {
  id: number;
  bookId: number;
  absolutePath: string;
  format: string | null;
  role: string;
  sizeBytes: number | null;
  mediaOverlayAvailable: boolean | null;
};

type PlannedMove = {
  fileId: number;
  from: string;
  to: string;
  sourceBookId: number;
};

@Injectable()
export class BookMergeService {
  private readonly logger = new Logger(BookMergeService.name);

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly libraryService: LibraryService,
    private readonly lockService: FileLockService,
    private readonly selfWriteRegistry: SelfWriteRegistry,
    private readonly coverStore: BookCoverStore,
  ) {}

  async mergeBooks(targetBookId: number, sourceBookIds: number[], user: RequestUser): Promise<BookMergeResult> {
    const startedAt = Date.now();
    const uniqueSourceIds = [...new Set(sourceBookIds)].filter((id) => id !== targetBookId);
    this.logger.log(`[${EVENT}] [start] targetBookId=${targetBookId} sourceCount=${uniqueSourceIds.length} userId=${user.id} - book merge started`);

    if (uniqueSourceIds.length === 0) {
      throw new BadRequestException('Select at least one other book to merge');
    }

    return this.lockService.withLock(bookOperationLockKey(targetBookId), async () => {
      try {
        const result = await this.mergeLocked(targetBookId, uniqueSourceIds, user);
        this.logger.log(
          `[${EVENT}] [end] targetBookId=${targetBookId} mergedSourceCount=${result.mergedSourceBookIds.length} movedFileCount=${result.movedFileCount} durationMs=${Date.now() - startedAt} - book merge completed`,
        );
        return result;
      } catch (error) {
        const errorClass = error instanceof Error ? error.name : 'Error';
        const errorMessage = sanitizeLogValue(error instanceof Error ? error.message : String(error));
        this.logger.warn(
          `[${EVENT}] [fail] targetBookId=${targetBookId} userId=${user.id} durationMs=${Date.now() - startedAt} errorClass=${errorClass} error="${errorMessage}" - book merge failed`,
        );
        throw error;
      }
    });
  }

  private async mergeLocked(targetBookId: number, sourceBookIds: number[], user: RequestUser): Promise<BookMergeResult> {
    const allIds = [targetBookId, ...sourceBookIds];
    const bookRows = await this.loadBooks(allIds);
    const byId = new Map(bookRows.map((row) => [row.id, row]));

    const target = byId.get(targetBookId);
    if (!target) throw new NotFoundException(`Book ${targetBookId} not found`);

    await this.libraryService.verifyUserAccess(user.id, target.libraryId, user.isSuperuser);

    if (target.organizationMode === 'book_per_file') {
      throw new BadRequestException('Cannot merge books in a File as Book library. Use Folder as Book so formats can share a folder.');
    }

    const sources: MergeBookRow[] = [];
    for (const sourceId of sourceBookIds) {
      const source = byId.get(sourceId);
      if (!source) throw new NotFoundException(`Book ${sourceId} not found`);
      if (source.libraryId !== target.libraryId) {
        throw new BadRequestException('Books must be in the same library to merge');
      }
      if (source.libraryFolderId !== target.libraryFolderId) {
        throw new BadRequestException('Books must be in the same library folder to merge');
      }
      if (source.organizationMode === 'book_per_file') {
        throw new BadRequestException('Cannot merge books from a File as Book library');
      }
      sources.push(source);
    }

    const sourceFiles = await this.loadContentFiles(sourceBookIds);
    if (sourceFiles.length === 0) {
      throw new BadRequestException('The selected books have no content files to merge');
    }

    const planned = await this.planMoves(target, sourceFiles);
    const completed: PlannedMove[] = [];
    const suppressionPaths = buildSuppressionPaths({
      sourcePaths: planned.map((move) => move.from),
      targetPaths: planned.map((move) => move.to),
      sourceFolderPath: sources[0]!.folderPath,
      targetFolderPath: target.folderPath,
      roots: [target.libraryFolderPath],
    });

    this.selfWriteRegistry.begin(suppressionPaths);
    try {
      for (const move of planned) {
        if (!(await pathExists(move.from))) {
          await this.rollback(completed);
          throw new BadRequestException(`Source file is missing: ${basename(move.from)}`);
        }
        if (await pathExists(move.to)) {
          await this.rollback(completed);
          throw new BadRequestException(`Destination already exists: ${basename(move.to)}`);
        }
        await moveFile(move.from, move.to);
        completed.push(move);
      }

      await this.applyDatabaseMerge(target, sources, completed);

      for (const source of sources) {
        await this.coverStore.removeCoverDirectory(source.id).catch(() => undefined);
        await this.cleanupSourceFolder(source.folderPath, target.libraryFolderPath);
      }

      return {
        targetBookId,
        mergedSourceBookIds: sources.map((source) => source.id),
        movedFileCount: completed.length,
      };
    } catch (error) {
      if (completed.length > 0) await this.rollback(completed);
      throw error;
    } finally {
      this.selfWriteRegistry.end(suppressionPaths);
    }
  }

  private loadBooks(bookIds: number[]): Promise<MergeBookRow[]> {
    return this.db
      .select({
        id: books.id,
        libraryId: books.libraryId,
        libraryFolderId: books.libraryFolderId,
        folderPath: books.folderPath,
        primaryFileId: books.primaryFileId,
        status: books.status,
        organizationMode: libraries.organizationMode,
        formatPriority: libraries.formatPriority,
        libraryFolderPath: libraryFolders.path,
        title: sql<string | null>`(select title from book_metadata where book_id = ${books.id} limit 1)`,
      })
      .from(books)
      .innerJoin(libraries, eq(libraries.id, books.libraryId))
      .innerJoin(libraryFolders, eq(libraryFolders.id, books.libraryFolderId))
      .where(inArray(books.id, bookIds));
  }

  private loadContentFiles(bookIds: number[]): Promise<MergeFileRow[]> {
    return this.db
      .select({
        id: bookFiles.id,
        bookId: bookFiles.bookId,
        absolutePath: bookFiles.absolutePath,
        format: bookFiles.format,
        role: bookFiles.role,
        sizeBytes: bookFiles.sizeBytes,
        mediaOverlayAvailable: bookFiles.mediaOverlayAvailable,
      })
      .from(bookFiles)
      .where(and(inArray(bookFiles.bookId, bookIds), eq(bookFiles.role, CONTENT_ROLE)))
      .orderBy(asc(bookFiles.id));
  }

  private async planMoves(target: MergeBookRow, files: MergeFileRow[]): Promise<PlannedMove[]> {
    const reserved = new Set<string>();
    const existing = await this.db.select({ absolutePath: bookFiles.absolutePath }).from(bookFiles).where(eq(bookFiles.bookId, target.id));
    for (const row of existing) reserved.add(row.absolutePath);

    const planned: PlannedMove[] = [];
    for (const file of files) {
      const extension = extname(file.absolutePath);
      const preferred = join(target.folderPath, basename(file.absolutePath));
      let destination = preferred;
      let attempt = 0;
      while (reserved.has(destination) || (await pathExists(destination))) {
        attempt += 1;
        if (attempt > MAX_COLLISION_ATTEMPTS) {
          throw new BadRequestException(`Could not find a free name for ${basename(file.absolutePath)} in the target folder`);
        }
        destination = withCollisionSuffix(preferred, attempt, extension);
      }
      reserved.add(destination);
      planned.push({
        fileId: file.id,
        from: file.absolutePath,
        to: destination,
        sourceBookId: file.bookId,
      });
    }
    return planned;
  }

  private async applyDatabaseMerge(target: MergeBookRow, sources: MergeBookRow[], moves: PlannedMove[]): Promise<void> {
    const sourceIds = sources.map((source) => source.id);
    const now = new Date();

    await this.db.transaction(async (tx) => {
      const [lockedTarget] = await tx
        .select({
          id: books.id,
          primaryFileId: books.primaryFileId,
          status: books.status,
          formatPriority: libraries.formatPriority,
        })
        .from(books)
        .innerJoin(libraries, eq(libraries.id, books.libraryId))
        .where(eq(books.id, target.id))
        .for('update', { of: books })
        .limit(1);

      if (!lockedTarget) throw new NotFoundException(`Book ${target.id} not found`);

      for (const move of moves) {
        const info = await stat(move.to, { bigint: true });
        await tx
          .update(bookFiles)
          .set({
            bookId: target.id,
            libraryFolderId: target.libraryFolderId,
            absolutePath: move.to,
            relPath: relative(target.libraryFolderPath, move.to),
            ino: info.ino,
            sizeBytes: Number(info.size),
            mtime: new Date(Number(info.mtimeMs)),
            updatedAt: now,
          })
          .where(eq(bookFiles.id, move.fileId));
      }

      const memberships = await tx
        .select({ collectionId: collectionBooks.collectionId })
        .from(collectionBooks)
        .where(inArray(collectionBooks.bookId, sourceIds));

      for (const membership of memberships) {
        await tx.insert(collectionBooks).values({ collectionId: membership.collectionId, bookId: target.id }).onConflictDoNothing();
      }

      // Clear source primaries before delete so moved files are not held by the outgoing books.
      await tx.update(books).set({ primaryFileId: null, updatedAt: now }).where(inArray(books.id, sourceIds));

      // Content rows already point at the target, so deleting sources only removes empty book shells.
      await tx.delete(books).where(inArray(books.id, sourceIds));

      const contentFiles = await tx
        .select({
          id: bookFiles.id,
          format: bookFiles.format,
          sizeBytes: bookFiles.sizeBytes,
          mediaOverlayAvailable: bookFiles.mediaOverlayAvailable,
        })
        .from(bookFiles)
        .where(and(eq(bookFiles.bookId, target.id), eq(bookFiles.role, CONTENT_ROLE)))
        .orderBy(asc(bookFiles.id));

      const winner = selectPrimaryFileKeepingCurrent(contentFiles, lockedTarget.primaryFileId, lockedTarget.formatPriority ?? []);
      await tx
        .update(books)
        .set({
          primaryFileId: winner?.id ?? null,
          status: 'present',
          updatedAt: now,
        })
        .where(eq(books.id, target.id));
    });
  }

  private async cleanupSourceFolder(sourceFolderPath: string, libraryRoot: string): Promise<void> {
    try {
      const entries = await readdir(sourceFolderPath);
      for (const entry of entries) {
        const absolutePath = join(sourceFolderPath, entry);
        const extension = extname(entry).toLowerCase();
        const stem = basename(entry, extension).toLowerCase();
        if (SIDECAR_COVER_NAMES.has(stem) && SIDECAR_COVER_EXTENSIONS.has(extension)) {
          await unlink(absolutePath).catch(() => undefined);
          continue;
        }
        if (extension === '.opf' || extension === '.nfo') {
          await unlink(absolutePath).catch(() => undefined);
        }
      }
    } catch {
      // Folder may already be gone after the content move.
    }
    await removeEmptyDirs(sourceFolderPath, libraryRoot);
    // Also try cleaning parent of a file that lived beside the book when folderPath was a file path.
    await removeEmptyDirs(dirname(sourceFolderPath), libraryRoot);
  }

  private async rollback(completed: PlannedMove[]): Promise<void> {
    for (const move of [...completed].reverse()) {
      try {
        await moveFileBack(move.to, move.from);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `[${EVENT}] [fail] from="${sanitizeLogValue(move.to)}" to="${sanitizeLogValue(move.from)}" error="${sanitizeLogValue(message)}" - merge rollback failed`,
        );
      }
    }
  }
}
