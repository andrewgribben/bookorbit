import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseClientService, type ReadwiseExportHighlight } from './readwise-client.service';
import { readwiseHighlightContentHash } from './readwise-highlight-hash.utils';
import { ReadwiseRepository } from './readwise.repository';

const EVENT = 'readwise.highlights_ledger_backfill';
const ANNOTATION_ID_PATTERN = /annotationId=(\d+)/;

/**
 * One-time S5 migration: before the ledger-based push/pull can take over from the old
 * `lastSyncedAnnotationId` watermark, every highlight BookOrbit already pushed under the old
 * scheme needs a `reading_service_item_links` row, or the ledger-based create query would see
 * them as unsynced and re-POST duplicates to Readwise.
 *
 * Matching: BookOrbit's own `highlight_url` (set at push time, see `readwise.constants.ts`
 * `bookOrbitReadwiseHighlightUrl`) carries `annotationId=<id>` as a query param, which Readwise
 * stores and returns unchanged in the export. That is the only reliable join key - v2 highlights
 * have no other reference back to a BookOrbit id (readwise-api.md §2 "Highlights are not linked
 * to BA books").
 */
@Injectable()
export class ReadwiseHighlightsLedgerBackfillService {
  private readonly logger = new Logger(ReadwiseHighlightsLedgerBackfillService.name);

  constructor(
    private readonly client: ReadwiseClientService,
    private readonly readwiseRepo: ReadwiseRepository,
    private readonly readingServicesRepo: ReadingServicesRepository,
  ) {}

  async backfill(userId: number, token: string): Promise<{ linked: number; unmatched: number }> {
    const startedAtMs = Date.now();
    let linked = 0;
    let unmatched = 0;
    let pageCursor: string | undefined;

    try {
      for (;;) {
        const page = await this.client.exportHighlights(userId, token, { pageCursor, includeDeleted: false });
        for (const book of page.results) {
          const parsed = this.parseAnnotationIds(book.highlights);
          if (parsed.length === 0) continue;
          const localRows = await this.readwiseRepo.findAnnotationsByIds(userId, parsed.map((p) => p.annotationId));
          const localById = new Map(localRows.map((r) => [r.id, r]));
          const items = parsed.flatMap(({ annotationId, highlight }) => {
            const local = localById.get(annotationId);
            if (!local) {
              unmatched += 1;
              return [];
            }
            return [
              {
                userId,
                provider: 'readwise' as const,
                kind: 'highlight',
                localId: annotationId,
                externalId: String(highlight.id),
                contentHash: readwiseHighlightContentHash(local.text, highlight.note || null),
              },
            ];
          });
          await this.readingServicesRepo.recordItemLinks(items);
          linked += items.length;
        }
        if (!page.nextPageCursor) break;
        pageCursor = page.nextPageCursor;
      }
      this.logger.log(
        `[${EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAtMs} linked=${linked} unmatched=${unmatched} - highlights ledger backfill completed`,
      );
      return { linked, unmatched };
    } catch (err) {
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      this.logger.warn(
        `[${EVENT}] [fail] userId=${userId} durationMs=${Date.now() - startedAtMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - highlights ledger backfill failed`,
      );
      throw err;
    }
  }

  private parseAnnotationIds(highlights: ReadwiseExportHighlight[]): { annotationId: number; highlight: ReadwiseExportHighlight }[] {
    const result: { annotationId: number; highlight: ReadwiseExportHighlight }[] = [];
    for (const highlight of highlights) {
      const match = highlight.highlight_url ? ANNOTATION_ID_PATTERN.exec(highlight.highlight_url) : null;
      if (!match) continue;
      result.push({ annotationId: Number(match[1]), highlight });
    }
    return result;
  }
}
