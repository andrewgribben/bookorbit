import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { appConfig } from '../../config/config';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseClientService, ReadwiseUnauthorizedError, type ReadwiseHighlight } from './readwise-client.service';
import { readwiseHighlightContentHash } from './readwise-highlight-hash.utils';
import { ReadwiseHighlightsLedgerBackfillService } from './readwise-highlights-ledger-backfill.service';
import {
  bookOrbitReadwiseHighlightUrl,
  openLibraryCoverUrl,
  READWISE_HIGHLIGHTS_LEDGER_BACKFILLED_CACHE_KEY,
  READWISE_HIGHLIGHTS_LEDGER_BACKFILLED_TTL_MS,
  READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE,
  READWISE_CATEGORY,
  READWISE_MAX,
  READWISE_SOURCE_TYPE,
} from './readwise.constants';
import { ReadwiseRepository, type NewHighlightRow } from './readwise.repository';
import { ReadwiseTokenService } from './readwise-token.service';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceLibraryScopeService } from '../reading-services/reading-service-library-scope.service';

const SYNC_EVENT = 'readwise.sync';

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * S5 takeover: this used to read/write a single annotation-id watermark
 * (`readwiseUserSettings.lastSyncedAnnotationId`). It now drives create, update and delete push
 * off the `reading_service_item_links` ledger (kind='highlight') instead, so edits and deletes
 * can be tracked per highlight rather than as one forward-only cursor. The watermark column is
 * kept on the schema for upstream compatibility but is never read here any more.
 */
@Injectable()
export class ReadwiseSyncService {
  private readonly logger = new Logger(ReadwiseSyncService.name);

  constructor(
    private readonly repo: ReadwiseRepository,
    private readonly client: ReadwiseClientService,
    private readonly tokens: ReadwiseTokenService,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly cache: ReadingServiceCacheService,
    private readonly ledgerBackfill: ReadwiseHighlightsLedgerBackfillService,
    private readonly libraryScopeService: ReadingServiceLibraryScopeService,
    @Inject(appConfig.KEY) private readonly appConfiguration: ConfigType<typeof appConfig>,
  ) {}

  async flush(userId: number): Promise<void> {
    const startedAtMs = Date.now();
    const settings = await this.repo.findSettings(userId);
    if (!(settings?.apiToken || settings?.apiTokenEncrypted) || !settings.enabled) return;
    const hasPermission = await this.repo.userHasReadwiseSyncPermission(userId);
    if (!hasPermission) return;
    const token = await this.tokens.getToken(userId);
    if (!token) return;

    const libraryIds = await this.resolveScopedLibraryIds(userId);
    if (libraryIds.length === 0) {
      this.logger.log(`[${SYNC_EVENT}] [skip] userId=${userId} - no library allows Readwise highlights, skipping push`);
      await this.repo.upsertSettings(userId, { lastSyncedAt: new Date() });
      return;
    }

    this.logger.log(`[${SYNC_EVENT}] [start] userId=${userId} - Readwise highlights push started`);
    try {
      await this.ensureLedgerBackfilled(userId, token);
      const created = await this.pushCreates(userId, token, libraryIds);
      const updated = await this.pushUpdates(userId, token, libraryIds);
      const deleted = await this.pushDeletes(userId, token);
      await this.repo.upsertSettings(userId, { lastSyncedAt: new Date() });
      this.logger.log(
        `[${SYNC_EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAtMs} created=${created} updated=${updated} deleted=${deleted} - Readwise highlights push completed`,
      );
    } catch (err) {
      const durationMs = Date.now() - startedAtMs;
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      if (err instanceof ReadwiseUnauthorizedError) {
        await this.repo.upsertSettings(userId, { disabledReason: 'invalid_token', enabled: false });
        this.logger.warn(
          `[${SYNC_EVENT}] [fail] userId=${userId} durationMs=${durationMs} errorClass=${errorClass} error="${sanitizeLogValue(err.message)}" - Readwise sync disabled after token rejection`,
        );
        return;
      }
      this.logger.warn(
        `[${SYNC_EVENT}] [fail] userId=${userId} durationMs=${durationMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - Readwise highlights push failed`,
      );
      throw err;
    }
  }

  /** Library ids where the `highlights` feature is effectively allowed; intersected with access. */
  private async resolveScopedLibraryIds(userId: number): Promise<number[]> {
    const pseudoUser = { id: userId, isSuperuser: false } as import('../../common/types/request-user').RequestUser;
    return this.libraryScopeService.getEffectiveLibraryIds(pseudoUser, 'readwise', 'highlights');
  }

  /** Runs the export-based ledger backfill once per user; a no-op on every later flush. */
  private async ensureLedgerBackfilled(userId: number, token: string): Promise<void> {
    const done = await this.cache.get<boolean>(userId, 'readwise', READWISE_HIGHLIGHTS_LEDGER_BACKFILLED_CACHE_KEY);
    if (done) return;
    await this.ledgerBackfill.backfill(userId, token);
    await this.cache.set(userId, 'readwise', READWISE_HIGHLIGHTS_LEDGER_BACKFILLED_CACHE_KEY, true, READWISE_HIGHLIGHTS_LEDGER_BACKFILLED_TTL_MS);
  }

  private async pushCreates(userId: number, token: string, libraryIds: number[] | null): Promise<number> {
    let created = 0;
    for (;;) {
      const rows = await this.repo.findPushableHighlights(userId, READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE, libraryIds);
      if (rows.length === 0) break;
      const payload = rows.map((r) => this.toHighlight(userId, r));
      const createdIds = await this.client.createHighlights(userId, token, payload);
      const ledgerItems = rows
        .map((row, index) => ({ row, externalId: createdIds[index] }))
        .filter((entry): entry is { row: NewHighlightRow; externalId: number } => entry.externalId !== undefined)
        .map(({ row, externalId }) => ({
          userId,
          provider: 'readwise' as const,
          kind: 'highlight',
          localId: row.annotationId,
          externalId: String(externalId),
          contentHash: readwiseHighlightContentHash(row.text, row.note),
        }));
      await this.readingServicesRepo.recordItemLinks(ledgerItems);
      created += ledgerItems.length;
      if (rows.length < READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE) break;
      // Every row not linked (createHighlights returned fewer ids than sent) would otherwise be
      // re-selected forever; stop this flush's create phase and let the next flush retry them.
      if (ledgerItems.length < rows.length) break;
    }
    return created;
  }

  private async pushUpdates(userId: number, token: string, libraryIds: number[] | null): Promise<number> {
    let updated = 0;
    let afterAnnotationId = 0;
    for (;;) {
      const rows = await this.repo.findChangedLinkedHighlights(userId, afterAnnotationId, READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE, libraryIds);
      if (rows.length === 0) break;
      const changed = rows.filter((r) => r.contentHash !== readwiseHighlightContentHash(r.text, r.note));
      for (const row of changed) {
        await this.client.updateHighlight(userId, token, row.externalId, { text: row.text, note: row.note ?? '' });
        await this.readingServicesRepo.updateItemLinkContentHash(
          userId,
          'readwise',
          'highlight',
          row.annotationId,
          readwiseHighlightContentHash(row.text, row.note),
        );
        updated += 1;
      }
      afterAnnotationId = rows[rows.length - 1]!.annotationId;
      if (rows.length < READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE) break;
    }
    return updated;
  }

  private async pushDeletes(userId: number, token: string): Promise<number> {
    let deleted = 0;
    for (;;) {
      const rows = await this.repo.findDeletedLinkedHighlights(userId, READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE);
      if (rows.length === 0) break;
      for (const row of rows) {
        await this.client.deleteHighlight(userId, token, row.externalId);
        await this.readingServicesRepo.markItemLinkDeleted(userId, 'readwise', 'highlight', row.annotationId);
        deleted += 1;
      }
      if (rows.length < READWISE_HIGHLIGHTS_PUSH_PAGE_SIZE) break;
    }
    return deleted;
  }

  private toHighlight(userId: number, r: NewHighlightRow): ReadwiseHighlight {
    const isbn = r.isbn13 || r.isbn10;
    return {
      text: truncate(r.text, READWISE_MAX.TEXT),
      ...(r.title ? { title: truncate(r.title, READWISE_MAX.TITLE) } : {}),
      ...(r.author ? { author: truncate(r.author, READWISE_MAX.AUTHOR) } : {}),
      ...(r.note ? { note: truncate(r.note, READWISE_MAX.NOTE) } : {}),
      ...(isbn ? { image_url: openLibraryCoverUrl(isbn) } : {}),
      highlighted_at: r.createdAt.toISOString(),
      highlight_url: truncate(bookOrbitReadwiseHighlightUrl(this.appConfiguration.appUrl, r.bookId, r.annotationId), READWISE_MAX.HIGHLIGHT_URL),
      source_type: READWISE_SOURCE_TYPE,
      category: READWISE_CATEGORY,
    };
  }
}
