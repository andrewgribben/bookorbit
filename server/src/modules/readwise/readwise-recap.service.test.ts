import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import type { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadwiseRecapService } from './readwise-recap.service';
import { ReadwiseBooksForbiddenError, type ReadwiseBooksClientService } from './readwise-books-client.service';
import type { ReadwiseSettingsService } from './readwise-settings.service';
import type { ReadwiseRepository } from './readwise.repository';

function makeService() {
  const client = { statsSummary: vi.fn(), sessionsByDay: vi.fn() } as unknown as ReadwiseBooksClientService;
  const readwiseSettings = { getToken: vi.fn().mockResolvedValue('tok') } as unknown as ReadwiseSettingsService;
  const readwiseRepo = {
    findSettings: vi.fn().mockResolvedValue({ enabled: true, disabledReason: null }),
    upsertSettings: vi.fn(),
  } as unknown as ReadwiseRepository;
  const featuresService = { getFeatures: vi.fn().mockResolvedValue({}) } as unknown as ReadingServiceFeaturesService;
  const cache = { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined) } as unknown as ReadingServiceCacheService;

  const service = new ReadwiseRecapService(client, readwiseSettings, readwiseRepo, featuresService, cache);
  return { service, client, readwiseSettings, readwiseRepo, featuresService, cache };
}

describe('ReadwiseRecapService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when Readwise is not enabled', async () => {
    const { service, readwiseRepo } = makeService();
    (readwiseRepo.findSettings as any).mockResolvedValue({ enabled: false, disabledReason: null });

    await expect(service.getRecap(1, 2026)).resolves.toBeNull();
  });

  it('returns null when Readwise has an auto-disable reason', async () => {
    const { service, readwiseRepo } = makeService();
    (readwiseRepo.findSettings as any).mockResolvedValue({ enabled: true, disabledReason: 'invalid_token' });

    await expect(service.getRecap(1, 2026)).resolves.toBeNull();
  });

  it('returns null when the recap_widget feature is explicitly off', async () => {
    const { service, featuresService } = makeService();
    (featuresService.getFeatures as any).mockResolvedValue({ recap_widget: false });

    await expect(service.getRecap(1, 2026)).resolves.toBeNull();
  });

  it('returns null when there is no token', async () => {
    const { service, readwiseSettings } = makeService();
    (readwiseSettings.getToken as any).mockResolvedValue(null);

    await expect(service.getRecap(1, 2026)).resolves.toBeNull();
  });

  it('returns a cached recap without calling the Readwise client', async () => {
    const { service, cache, client } = makeService();
    const cached = { provider: 'readwise', year: 2026, booksFinished: 1, sessions: 1, totalSeconds: 1, readingDays: 1, goal: null, byMonth: [] };
    (cache.get as any).mockResolvedValue(cached);

    await expect(service.getRecap(1, 2026)).resolves.toEqual(cached);
    expect(client.statsSummary).not.toHaveBeenCalled();
  });

  it('builds the recap from stats summary and sessions-by-day, bucketed by month', async () => {
    const { service, client, cache } = makeService();
    (client.statsSummary as any).mockResolvedValue({
      books_started: 10,
      books_finished: 8,
      session_count: 40,
      total_time_seconds: 72_000,
      total_xp: 0,
      reading_days: 20,
      target_books_read: 50,
    });
    (client.sessionsByDay as any).mockResolvedValue([
      { date: '2026-01-05', session_count: 2, total_time_seconds: 600, total_xp: 0, book_ids: ['a'] },
      { date: '2026-01-20', session_count: 1, total_time_seconds: 300, total_xp: 0, book_ids: ['a'] },
      { date: '2026-02-01', session_count: 1, total_time_seconds: 900, total_xp: 0, book_ids: ['b'] },
    ]);

    const result = await service.getRecap(1, 2026);

    expect(result).toEqual({
      provider: 'readwise',
      year: 2026,
      booksFinished: 8,
      sessions: 40,
      totalSeconds: 72_000,
      readingDays: 20,
      goal: 50,
      byMonth: [
        { month: 1, seconds: 900 },
        { month: 2, seconds: 900 },
        ...Array.from({ length: 10 }, (_, i) => ({ month: i + 3, seconds: 0 })),
      ],
    });
    expect(cache.set).toHaveBeenCalledWith(1, 'readwise', 'recap:2026', result, expect.any(Number));
  });

  it('turns a 403 into disabling the sync and returns null', async () => {
    const { service, client, readwiseRepo } = makeService();
    (client.statsSummary as any).mockRejectedValue(new ReadwiseBooksForbiddenError());

    await expect(service.getRecap(1, 2026)).resolves.toBeNull();
    expect(readwiseRepo.upsertSettings).toHaveBeenCalledWith(1, { disabledReason: 'no_readwise_books', enabled: false });
  });

  it('returns null, not a throw, when the Readwise call fails for another reason', async () => {
    const { service, client } = makeService();
    (client.statsSummary as any).mockRejectedValue(new Error('network error'));

    await expect(service.getRecap(1, 2026)).resolves.toBeNull();
  });
});
