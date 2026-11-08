import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServiceCacheService } from '../reading-services/reading-service-cache.service';
import { ReadingServiceFeaturesService } from '../reading-services/reading-service-features.service';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import type { ReadwiseExportHighlight } from './readwise-client.service';
import { ReadwiseClientService } from './readwise-client.service';
import { readwiseHighlightContentHash } from './readwise-highlight-hash.utils';
import { ReadwiseHighlightsLocalRepository } from './readwise-highlights-local.repository';
import {
  READWISE_HIGHLIGHTS_PULL_CURSOR_CACHE_KEY,
  READWISE_HIGHLIGHTS_PULL_CURSOR_TTL_MS,
  READWISE_HIGHLIGHTS_PULL_INTERVAL_MS,
  READWISE_HIGHLIGHTS_PULL_USER_CONCURRENCY,
} from './readwise.constants';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';

const EVENT = 'readwise.highlights_pull';

/**
 * S5 pull: edits and deletes on highlights BookOrbit already linked (pushed, or matched by the
 * ledger backfill) flow back from Readwise on the same interval cadence as books/sessions.
 *
 * New highlights created on the Readwise side (never linked here) are counted but not created
 * locally: a BookOrbit annotation needs a book-file anchor (CFI/location, see
 * `annotation_positions`), and a highlight made outside BookOrbit carries no such anchor -
 * Readwise highlights are not linked to a BA book id either (readwise-api.md §2), so there is no
 * reliable way to place one in a specific reader position. This is the schema-check finding from
 * the S5 plan step 1, recorded in `docs/AGENT_HANDOFF.md`.
 *
 * Echo suppression: this never calls `AnnotationService`/`AnnotationSyncService`, so no
 * `annotation.updated`/`annotation.deleted` event fires from a pull write, and the push side
 * (triggered only by those events, or by its own debounced re-flush) never sees its own pull back.
 */
@Injectable()
export class ReadwiseHighlightsPullService {
  private readonly logger = new Logger(ReadwiseHighlightsPullService.name);

  constructor(
    private readonly client: ReadwiseClientService,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly readwiseSettings: ReadwiseSettingsService,
    private readonly readingServicesRepo: ReadingServicesRepository,
    private readonly featuresService: ReadingServiceFeaturesService,
    private readonly cache: ReadingServiceCacheService,
    private readonly localRepo: ReadwiseHighlightsLocalRepository,
  ) {}

  @Interval(READWISE_HIGHLIGHTS_PULL_INTERVAL_MS)
  async pullAllConnectedUsers(): Promise<void> {
    const userIds = await this.readwiseRepo.findConnectedUserIds();
    for (let i = 0; i < userIds.length; i += READWISE_HIGHLIGHTS_PULL_USER_CONCURRENCY) {
      const batch = userIds.slice(i, i + READWISE_HIGHLIGHTS_PULL_USER_CONCURRENCY);
      await Promise.all(batch.map((userId) => this.pullForUser(userId).catch((err) => this.logFailure(userId, err))));
    }
  }

  async pullForUser(userId: number): Promise<{ edited: number; deleted: number; skippedNew: number }> {
    const counters = { edited: 0, deleted: 0, skippedNew: 0 };
    const token = await this.readwiseSettings.getToken(userId);
    if (!token) return counters;

    const features = await this.featuresService.getFeatures(userId, 'readwise');
    if (features.highlights === false) return counters;

    const updatedAfter = await this.cache.get<string>(userId, 'readwise', READWISE_HIGHLIGHTS_PULL_CURSOR_CACHE_KEY);
    const startedAt = Date.now();
    const nowIso = new Date().toISOString();

    let pageCursor: string | undefined;
    for (;;) {
      const page = await this.client.exportHighlights(userId, token, {
        updatedAfter: updatedAfter ?? undefined,
        includeDeleted: true,
        pageCursor,
      });
      for (const book of page.results) {
        for (const highlight of book.highlights) {
          await this.applyRemoteHighlight(userId, highlight, counters);
        }
      }
      if (!page.nextPageCursor || page.results.length === 0) break;
      pageCursor = page.nextPageCursor;
    }

    await this.cache.set(userId, 'readwise', READWISE_HIGHLIGHTS_PULL_CURSOR_CACHE_KEY, nowIso, READWISE_HIGHLIGHTS_PULL_CURSOR_TTL_MS);
    this.logger.log(
      `[${EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAt} edited=${counters.edited} deleted=${counters.deleted} skippedNew=${counters.skippedNew} - highlights pull completed`,
    );
    return counters;
  }

  private async applyRemoteHighlight(
    userId: number,
    highlight: ReadwiseExportHighlight,
    counters: { edited: number; deleted: number; skippedNew: number },
  ): Promise<void> {
    const link = await this.readingServicesRepo.findItemLinkByExternalId(userId, 'readwise', 'highlight', String(highlight.id));
    if (!link) {
      // Not locatable in BookOrbit (see class doc); counted so the UI/logs can surface it.
      counters.skippedNew += 1;
      return;
    }
    if (link.deletedAt) return; // already reconciled by an earlier pull or by our own delete push

    if (highlight.is_deleted) {
      const applied = await this.localRepo.applyRemoteDelete(userId, link.localId);
      await this.readingServicesRepo.markItemLinkDeleted(userId, 'readwise', 'highlight', link.localId);
      if (applied) counters.deleted += 1;
      return;
    }

    const remoteHash = readwiseHighlightContentHash(highlight.text, highlight.note || null);
    if (remoteHash === link.contentHash) return; // no remote change since the ledger's last known state

    const applied = await this.localRepo.applyRemoteEdit(userId, link.localId, { text: highlight.text, note: highlight.note || null });
    if (applied) {
      await this.readingServicesRepo.updateItemLinkContentHash(userId, 'readwise', 'highlight', link.localId, remoteHash);
      counters.edited += 1;
    }
  }

  private logFailure(userId: number, err: unknown): void {
    const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
    this.logger.error(
      `[${EVENT}] [fail] userId=${userId} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - highlights pull failed`,
    );
  }
}
