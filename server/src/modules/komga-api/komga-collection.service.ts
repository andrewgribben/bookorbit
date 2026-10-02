import { Injectable } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import type { RequestUser } from '../../common/types/request-user';
import { CollectionService } from '../collection/collection.service';
import type { KomgaCollection, KomgaPage } from './komga-api.types';
import { decodeKomgaId, komgaNotFound, resolveKomgaPagination, toKomgaPage } from './komga-ids';
import { toKomgaCollection } from './komga.mappers';
import { KomgaBookService } from './komga-book.service';
import { KomgaRepository } from './komga.repository';

export interface KomgaPagedQuery {
  page?: number;
  size?: number;
  unpaged?: boolean;
  search?: string;
  library_id?: number[];
}

/** Projected over BookOrbit collections; BookOrbit has no series-set entity. */
@Injectable()
export class KomgaCollectionService {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly repo: KomgaRepository,
    private readonly komgaBookService: KomgaBookService,
  ) {}

  private async seriesIdsByCollection(collectionIds: number[]): Promise<Map<number, number[]>> {
    const rows = await this.repo.findSeriesIdsByCollections(collectionIds);
    const grouped = new Map<number, number[]>();
    for (const row of rows) {
      const current = grouped.get(row.collectionId);
      if (current) current.push(row.seriesId);
      else grouped.set(row.collectionId, [row.seriesId]);
    }
    return grouped;
  }

  async listCollections(user: RequestUser, query: KomgaPagedQuery): Promise<KomgaPage<KomgaCollection>> {
    const { page, size } = resolveKomgaPagination(query);

    const all = await this.collectionService.findAll(user);
    const search = query.search?.trim().toLowerCase();
    const matching = search ? all.filter((collection) => collection.name.toLowerCase().includes(search)) : all;
    const slice = matching.slice(page * size, page * size + size);
    const seriesIds = await this.seriesIdsByCollection(slice.map((collection) => collection.id));

    return toKomgaPage(
      slice.map((collection) =>
        toKomgaCollection({
          id: collection.id,
          name: collection.name,
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt,
          seriesIds: seriesIds.get(collection.id) ?? [],
        }),
      ),
      matching.length,
      page,
      size,
      Boolean(search),
    );
  }

  async getCollection(user: RequestUser, rawCollectionId: string): Promise<KomgaCollection> {
    const collectionId = decodeKomgaId(rawCollectionId, 'collection');
    const collection = await this.collectionService.findOne(collectionId, user);
    const seriesIds = await this.seriesIdsByCollection([collectionId]);

    return toKomgaCollection({
      id: collection.id,
      name: collection.name,
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
      seriesIds: seriesIds.get(collectionId) ?? [],
    });
  }

  async listCollectionsForSeries(user: RequestUser, seriesId: number): Promise<KomgaCollection[]> {
    const collections = await this.repo.findReadableCollectionsForSeries(user.id, seriesId);
    const seriesIds = await this.seriesIdsByCollection(collections.map((collection) => collection.id));

    return collections.map((collection) =>
      toKomgaCollection({
        id: collection.id,
        name: collection.name,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
        seriesIds: seriesIds.get(collection.id) ?? [],
      }),
    );
  }

  /** A collection's poster is the cover of its first book, the same rule the series route uses. */
  async streamThumbnail(user: RequestUser, rawCollectionId: string, reply: FastifyReply): Promise<void> {
    const collectionId = decodeKomgaId(rawCollectionId, 'collection');
    const books = await this.collectionService.getBooks(collectionId, user, 0, 1);
    const book = books.items[0];
    if (!book) throw komgaNotFound('collection', collectionId);

    await this.komgaBookService.streamCover(user, book.id, reply);
  }
}
