import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { KomgaPage } from './komga-api.types';
import { KOMGA_DEFAULT_PAGE_SIZE, KOMGA_MAX_PAGE_SIZE } from './komga-api.constants';

export function encodeKomgaId(id: number): string {
  return String(id);
}

export function decodeKomgaId(raw: string, entity: string): number {
  if (raw.trim().length === 0) {
    // A trailing-slash request lands here (`/series/`); Komga answers an unknown id with 404, and
    // clients branch on that instead of retrying a generic 400.
    throw komgaNotFound(entity, raw);
  }
  if (!/^\d{1,10}$/.test(raw)) {
    throw new BadRequestException(`Invalid ${entity} id`);
  }
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new BadRequestException(`Invalid ${entity} id`);
  }
  return id;
}

export function komgaNotFound(entity: string, id: string | number): NotFoundException {
  return new NotFoundException(`Unknown ${entity}: ${id}`);
}

export function clampKomgaPageSize(size: number | undefined): number {
  if (size === undefined) return KOMGA_DEFAULT_PAGE_SIZE;
  if (!Number.isFinite(size) || size < 1) throw new BadRequestException('size must be a positive integer');
  return Math.min(Math.trunc(size), KOMGA_MAX_PAGE_SIZE);
}

/**
 * `unpaged` is accepted but capped: returning the real total would materialize a whole library,
 * so the maximum page size is used instead, which is still honest about what the client sees.
 */
export function resolveKomgaPagination(query: { page?: number; size?: number; unpaged?: boolean }): { page: number; size: number } {
  if (query.unpaged === true) {
    return { page: 0, size: KOMGA_MAX_PAGE_SIZE };
  }
  const page = query.page ?? 0;
  if (!Number.isInteger(page) || page < 0) throw new BadRequestException('page must be a non-negative integer');
  return { page, size: clampKomgaPageSize(query.size) };
}

export function toIso(value: Date | string | null | undefined, fallback: string): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
  }
  return fallback;
}

/** BookOrbit stores series index as free text ("1", "1.5"); Komga wants a number and a string. */
export function parseSeriesNumber(seriesIndex: string | null | undefined): number {
  if (!seriesIndex) return -1;
  const parsed = Number.parseFloat(seriesIndex);
  return Number.isFinite(parsed) ? parsed : -1;
}

export function toKomgaPage<T>(items: T[], total: number, page: number, size: number, sorted: boolean, unpaged = false): KomgaPage<T> {
  const totalPages = unpaged ? (total > 0 ? 1 : 0) : size > 0 ? Math.ceil(total / size) : 0;
  const sort = { empty: !sorted, sorted, unsorted: !sorted };
  return {
    content: items,
    empty: items.length === 0,
    first: page === 0,
    last: unpaged ? items.length >= total : totalPages === 0 ? true : page >= totalPages - 1,
    number: page,
    numberOfElements: items.length,
    pageable: {
      offset: page * size,
      pageNumber: page,
      pageSize: size,
      paged: !unpaged,
      sort,
      unpaged,
    },
    size,
    sort,
    totalElements: total,
    totalPages,
  };
}
