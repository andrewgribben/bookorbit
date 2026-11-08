import { Injectable, Logger } from '@nestjs/common';

import type { ReadingRecapMonthData, ReadingRecapWidget } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import type { ReadwiseSessionsByDayEntry } from './readwise-books-client.service';
import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { READWISE_RECAP_CACHE_KEY_PREFIX, READWISE_RECAP_CACHE_TTL_MS } from './readwise.constants';
import { ReadwiseSettingsService } from './readwise-settings.service';
import { ReadwiseRepository } from './readwise.repository';

const PROVIDER = 'readwise' as const;
const MONTHS_IN_YEAR = 12;

function startOfYearIso(year: number): string {
  return `${year}-01-01`;
}

/** Local-day `YYYY-MM-DD` for "today", matching `sessionsByDay`'s date format. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Buckets `sessions-by-day` entries into the 12 months of the year the recap covers. */
export function buildMonthlySeconds(days: Pick<ReadwiseSessionsByDayEntry, 'date' | 'total_time_seconds'>[]): ReadingRecapMonthData[] {
  const totals = new Array<number>(MONTHS_IN_YEAR).fill(0);
  for (const day of days) {
    const month = Number(day.date.slice(5, 7));
    if (month >= 1 && month <= MONTHS_IN_YEAR) totals[month - 1] += day.total_time_seconds;
  }
  return totals.map((seconds, index) => ({ month: index + 1, seconds }));
}

/**
 * Builds the dashboard "reading recap" widget (S7) from Readwise Books stats, cached per user per
 * year via `reading_service_cache`. Returns null (never an empty-shaped object) whenever the
 * widget has nothing real to show, so the client can hide it entirely rather than render a card
 * with zeros for a provider the user never connected.
 */
@Injectable()
export class ReadwiseRecapService {
  private readonly logger = new Logger(ReadwiseRecapService.name);

  constructor(
    private readonly client: ReadwiseBooksClientService,
    private readonly readwiseSettings: ReadwiseSettingsService,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly featuresService: ReadingServiceFeaturesService,
    private readonly cache: ReadingServiceCacheService,
  ) {}

  async getRecap(userId: number, year: number = new Date().getUTCFullYear()): Promise<ReadingRecapWidget | null> {
    const settings = await this.readwiseRepo.findSettings(userId);
    if (!settings?.enabled || settings.disabledReason) return null;

    const features = await this.featuresService.getFeatures(userId, PROVIDER);
    if (features.recap_widget === false) return null;

    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return null;

    const cacheKey = `${READWISE_RECAP_CACHE_KEY_PREFIX}:${year}`;
    const cached = await this.cache.get<ReadingRecapWidget>(userId, PROVIDER, cacheKey);
    if (cached) return cached;

    try {
      const [summary, byDay] = await Promise.all([
        this.client.statsSummary(userId, token, year),
        this.client.sessionsByDay(userId, token, startOfYearIso(year), todayIso()),
      ]);

      const recap: ReadingRecapWidget = {
        provider: PROVIDER,
        year,
        booksFinished: summary.books_finished,
        sessions: summary.session_count,
        totalSeconds: summary.total_time_seconds,
        readingDays: summary.reading_days,
        goal: summary.target_books_read ?? null,
        byMonth: buildMonthlySeconds(byDay),
      };

      await this.cache.set(userId, PROVIDER, cacheKey, recap, READWISE_RECAP_CACHE_TTL_MS);
      return recap;
    } catch (err) {
      if (err instanceof ReadwiseBooksForbiddenError) {
        await this.readwiseRepo.upsertSettings(userId, { disabledReason: 'no_readwise_books', enabled: false });
        return null;
      }
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      this.logger.warn(
        `[readwise.recap] [fail] userId=${userId} year=${year} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - recap widget fetch failed`,
      );
      return null;
    }
  }
}
