import { Injectable } from '@nestjs/common';

import type { ReadingServiceProvider } from '@bookorbit/types';

import { ReadingServicesRepository } from './reading-services.repository';

/** TTL cache for social and stats payloads (recap widget, future friends/discover shelves). */
@Injectable()
export class ReadingServiceCacheService {
  constructor(private readonly repo: ReadingServicesRepository) {}

  async get<T>(userId: number, provider: ReadingServiceProvider, key: string): Promise<T | null> {
    const row = await this.repo.findCache(userId, provider, key);
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return row.payload as T;
  }

  async set<T>(userId: number, provider: ReadingServiceProvider, key: string, payload: T, ttlMs: number): Promise<void> {
    await this.repo.setCache(userId, provider, key, payload, new Date(Date.now() + ttlMs));
  }
}
