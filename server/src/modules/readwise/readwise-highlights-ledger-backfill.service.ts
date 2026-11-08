import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseClientService, type ReadwiseExportHighlight } from './readwise-client.service';
import { readwiseHighlightContentHash } from './readwise-highlight-hash.utils';
import { ReadwiseRepository } from './readwise.repository';

const EVENT = 'readwise.highlights_ledger_backfill';
const ANNOTATION_ID_PATTERN = /annotationId=(\d+)/;
const BOOK_ID_PATTERN = /\/book\/(\d+)/;

/**
 * One-time S5 migration: before the ledger-based push/pull can take over from the old
 * `lastSyncedAnnotationId` watermark, every highlight BookOrbit already pushed under the old
 * scheme needs a `reading_service_item_links` row, or the ledger-based create query would see
 * them as unsynced and re-POST duplicates to Readwise.
 *
 * This also doubles as the general reconnect-safe reconcile pass for highlights: it runs the
 * first time any user flushes (see `ReadwiseSyncService.ensureLedgerBackfilled`), including a
 * brand-new BookOrbit install/restore that has never synced before, so it must cope with
 * highlights the Readwise account picked up from a *different* BookOrbit instance (e.g. a
 * staging copy that already connected and pushed before live did).
 *
 * Matching, in order:
 * 1. BookOrbit's own `highlight_url` (set at push time, see `readwise.constants.ts`
 *    `bookOrbitReadwiseHighlightUrl`) carries `annotationId=<id>` as a query param. That id is
 *    ONLY trustworthy when the local annotation it names still has the same text: two divergent
 *    BookOrbit databases (e.g. a live instance restored from an older backup, continuing its own
 *    autoincrement sequence) can reuse the same numeric annotation id for a completely different
 *    highlight, so the id by itself is never proof of identity across instances.
 * 2. Content match: same book, exact normalized text, not already linked. This is what makes a
 *    highlight pushed by *another* BookOrbit instance (no parseable id, or an id that fails the
 *    text check) link instead of being re-created as a duplicate on this instance.
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
          const result = await this.linkBookHighlights(userId, book.highlights);
          linked += result.linked;
          unmatched += result.unmatched;
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

  private async linkBookHighlights(userId: number, highlights: ReadwiseExportHighlight[]): Promise<{ linked: number; unmatched: number }> {
    const parsed = highlights.map((highlight) => ({ highlight, ids: this.parseUrlIds(highlight.highlight_url) }));
    const annotationIds = parsed.flatMap(({ ids }) => (ids.annotationId !== null ? [ids.annotationId] : []));
    const localRows = await this.readwiseRepo.findAnnotationsByIds(userId, annotationIds);
    const localById = new Map(localRows.map((r) => [r.id, r]));

    let linked = 0;
    let unmatched = 0;
    const items: Parameters<ReadingServicesRepository['recordItemLinks']>[0] = [];

    for (const { highlight, ids } of parsed) {
      const idMatch = ids.annotationId !== null ? localById.get(ids.annotationId) : undefined;

      if (idMatch && idMatch.text === highlight.text) {
        items.push(this.toLinkItem(userId, idMatch.id, highlight));
        linked += 1;
        continue;
      }

      // Either the id was absent/stale (another BookOrbit instance pushed this), or it collided
      // with an unrelated local annotation sharing the same id across two divergent databases.
      // The bookId embedded in the URL (set by whichever instance pushed it) still identifies the
      // right book in the common "restore from an earlier shared backup" case; fall back to an
      // exact-text match scoped to that book, preferring the id match's own book when available.
      const bookId = idMatch?.bookId ?? ids.bookId;
      const contentMatch = bookId !== null ? await this.readwiseRepo.findUnlinkedAnnotationByText(userId, bookId, highlight.text) : undefined;
      if (contentMatch) {
        items.push(this.toLinkItem(userId, contentMatch.id, highlight));
        linked += 1;
        continue;
      }

      unmatched += 1;
    }

    await this.readingServicesRepo.recordItemLinks(items);
    return { linked, unmatched };
  }

  private toLinkItem(userId: number, localId: number, highlight: ReadwiseExportHighlight) {
    return {
      userId,
      provider: 'readwise' as const,
      kind: 'highlight',
      localId,
      externalId: String(highlight.id),
      contentHash: readwiseHighlightContentHash(highlight.text, highlight.note || null),
    };
  }

  private parseUrlIds(highlightUrl: string | null): { annotationId: number | null; bookId: number | null } {
    const annotationMatch = highlightUrl ? ANNOTATION_ID_PATTERN.exec(highlightUrl) : null;
    const bookMatch = highlightUrl ? BOOK_ID_PATTERN.exec(highlightUrl) : null;
    return {
      annotationId: annotationMatch ? Number(annotationMatch[1]) : null,
      bookId: bookMatch ? Number(bookMatch[1]) : null,
    };
  }
}
