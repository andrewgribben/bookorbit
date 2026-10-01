import { Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import type { BookCard } from '@bookorbit/types';
import type { RequestUser } from '../../common/types/request-user';
import { CollectionService } from '../collection/collection.service';
import { LibraryService } from '../library/library.service';
import { KOMGA_READLIST_ICON } from './komga-api.constants';
import type { KomgaBook, KomgaPage, KomgaReadList } from './komga-api.types';
import { decodeKomgaId, encodeKomgaId, komgaNotFound, resolveKomgaPagination, toKomgaPage } from './komga-ids';
import { toKomgaReadList } from './komga.mappers';
import { KomgaBookService } from './komga-book.service';
import { KomgaRepository } from './komga.repository';
import type { KomgaPagedQuery } from './komga-collection.service';

export interface KomgaReadListWrite {
  name?: string;
  summary?: string;
  bookIds?: string[];
  ordered?: boolean;
}

/** Full CRUD: BookOrbit collections are user-scoped ordered book sets. */
@Injectable()
export class KomgaReadListService {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly libraryService: LibraryService,
    private readonly repo: KomgaRepository,
    private readonly komgaBookService: KomgaBookService,
  ) {}

  private async bookIdsByCollection(collectionIds: number[], user: RequestUser): Promise<Map<number, number[]>> {
    const libraryIds = await this.libraryService.findAccessibleLibraryIds(user);
    const rows = await this.repo.findBookIdsByCollections(collectionIds, libraryIds, user.isSuperuser ? undefined : user.contentFilters);
    const grouped = new Map<number, number[]>();
    for (const row of rows) {
      const current = grouped.get(row.collectionId);
      if (current) current.push(row.bookId);
      else grouped.set(row.collectionId, [row.bookId]);
    }
    return grouped;
  }

  private decodeBookIds(bookIds: string[]): number[] {
    return bookIds.map((bookId) => decodeKomgaId(bookId, 'book'));
  }

  async listReadLists(user: RequestUser, query: KomgaPagedQuery): Promise<KomgaPage<KomgaReadList>> {
    const { page, size } = resolveKomgaPagination(query);

    const all = await this.collectionService.findAll(user);
    const search = query.search?.trim().toLowerCase();
    const matching = search ? all.filter((collection) => collection.name.toLowerCase().includes(search)) : all;
    const slice = matching.slice(page * size, page * size + size);
    const bookIds = await this.bookIdsByCollection(
      slice.map((collection) => collection.id),
      user,
    );

    return toKomgaPage(
      slice.map((collection) =>
        toKomgaReadList({
          id: collection.id,
          name: collection.name,
          description: collection.description,
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt,
          bookIds: bookIds.get(collection.id) ?? [],
        }),
      ),
      matching.length,
      page,
      size,
      Boolean(search),
    );
  }

  async getReadList(user: RequestUser, rawReadListId: string): Promise<KomgaReadList> {
    const readListId = decodeKomgaId(rawReadListId, 'readlist');
    const collection = await this.collectionService.findOne(readListId, user);
    const bookIds = await this.bookIdsByCollection([readListId], user);

    return toKomgaReadList({
      id: collection.id,
      name: collection.name,
      description: collection.description,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      bookIds: bookIds.get(readListId) ?? [],
    });
  }

  async createReadList(user: RequestUser, input: KomgaReadListWrite): Promise<KomgaReadList> {
    const collection = await this.collectionService.create(
      { name: input.name ?? 'Read list', icon: KOMGA_READLIST_ICON, description: input.summary },
      user,
    );

    const bookIds = input.bookIds ? this.decodeBookIds(input.bookIds) : [];
    if (bookIds.length > 0) {
      await this.collectionService.addBooks(collection.id, { bookIds }, user);
    }

    return this.getReadList(user, encodeKomgaId(collection.id));
  }

  async updateReadList(user: RequestUser, rawReadListId: string, input: KomgaReadListWrite): Promise<void> {
    const readListId = decodeKomgaId(rawReadListId, 'readlist');

    if (input.name !== undefined || input.summary !== undefined) {
      await this.collectionService.update(
        readListId,
        {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.summary !== undefined ? { description: input.summary } : {}),
        },
        user,
      );
    }

    if (input.bookIds !== undefined) {
      const requested = this.decodeBookIds(input.bookIds);
      const existing = (await this.bookIdsByCollection([readListId], user)).get(readListId) ?? [];
      if (existing.length > 0) {
        await this.collectionService.removeBooks(readListId, { bookIds: existing }, user);
      }
      if (requested.length > 0) {
        await this.collectionService.addBooks(readListId, { bookIds: requested }, user);
      }
    }
  }

  async deleteReadList(user: RequestUser, rawReadListId: string): Promise<void> {
    await this.collectionService.remove(decodeKomgaId(rawReadListId, 'readlist'), user);
  }

  async listBooks(user: RequestUser, rawReadListId: string, query: KomgaPagedQuery): Promise<KomgaPage<KomgaBook>> {
    const readListId = decodeKomgaId(rawReadListId, 'readlist');
    const { page, size } = resolveKomgaPagination(query);

    const books = await this.collectionService.getBooks(readListId, user, page, size);
    const items = await this.komgaBookService.toKomgaBooks(user, books.items as BookCard[]);

    return toKomgaPage(items, books.total, books.page, books.size, true);
  }

  async listReadListsForBook(user: RequestUser, rawBookId: string): Promise<KomgaReadList[]> {
    const bookId = decodeKomgaId(rawBookId, 'book');
    const collections = await this.repo.findReadableCollectionsForBook(user.id, bookId);
    const bookIds = await this.bookIdsByCollection(
      collections.map((collection) => collection.id),
      user,
    );

    return collections.map((collection) =>
      toKomgaReadList({
        id: collection.id,
        name: collection.name,
        description: collection.description,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        bookIds: bookIds.get(collection.id) ?? [],
      }),
    );
  }

  async streamThumbnail(user: RequestUser, rawReadListId: string, reply: FastifyReply): Promise<void> {
    const readListId = decodeKomgaId(rawReadListId, 'readlist');
    const books = await this.collectionService.getBooks(readListId, user, 0, 1);
    const book = books.items[0];
    if (!book) throw komgaNotFound('readlist', readListId);

    await this.komgaBookService.streamCover(user, book.id, reply);
  }
}
