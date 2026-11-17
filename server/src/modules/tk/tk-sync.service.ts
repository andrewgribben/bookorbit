import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';

import { appConfig } from '../../config/config';
import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { resolveTimeZone, toDateKeyInTimeZone } from '../../common/utils/timezone.utils';
import type { TkPendingAnnotationRow, TkPendingFinishedRow, TkPendingJournalRow, TkWatermarkUpdate } from './tk.repository';
import { TkRepository, type TkLedgerInsert } from './tk.repository';
import { TkOAuthService } from './tk-oauth.service';
import { TkMcpClient, TkHttpError, TkRpcError, type TkFetchFn } from './tk-mcp-client';
import { TK_FLUSH_PAGE_SIZE, TK_TAGS, bookOrbitTkAnnotationUrl, bookOrbitTkBookUrl } from './tk.constants';
import { TK_FETCH } from './tk.tokens';
import { groupItemsByDateKey } from './tk-grouping.utils';
import { renderDayBlock } from './tk-markdown.utils';
import { findTkAnchor, noteContainsLinkTo } from './tk-tiptap.utils';
import type { TkDailyNoteDoc, TkSyncItem } from './tk.types';

interface TkDailyNoteResult {
  found: boolean;
  id?: string;
  content?: TkDailyNoteDoc;
}

interface TkCreateDocumentResult {
  id: string;
}

const SYNC_EVENT = 'tk.sync';
const SHARED_DOC_PATTERN = /shar/i;
const ALREADY_EXISTS_PATTERN = /already/i;

@Injectable()
export class TkSyncService {
  private readonly logger = new Logger(TkSyncService.name);

  constructor(
    private readonly repo: TkRepository,
    private readonly oauth: TkOAuthService,
    @Inject(appConfig.KEY) private readonly appConfiguration: ConfigType<typeof appConfig>,
    @Inject(TK_FETCH) private readonly fetchFn: TkFetchFn,
  ) {}

  async flush(userId: number): Promise<void> {
    const startedAtMs = Date.now();
    const settings = await this.repo.findSettings(userId);
    if (!settings || !settings.enabled) return;
    const hasPermission = await this.repo.userHasTkSyncPermission(userId);
    if (!hasPermission) return;
    const token = this.oauth.getToken(settings);
    if (!token) return;

    const items = await this.collectPendingItems(userId, settings, false);
    if (items.length === 0) return;

    const client = new TkMcpClient({
      fetchFn: this.fetchFn,
      token,
      onTokenRefreshed: (refreshed) => this.oauth.saveRefreshedToken(userId, refreshed),
    });

    const grouped = groupItemsByDateKey(items);
    const watermarks: TkWatermarkUpdate = {};
    let processedCount = 0;

    try {
      for (const [dateKey, dayItems] of grouped) {
        const outcome = await this.flushDay(client, userId, dateKey, dayItems);
        if (outcome === 'skipped') continue;
        this.advanceWatermarks(watermarks, dayItems);
        processedCount += dayItems.length;
      }
    } catch (err) {
      if (err instanceof TkHttpError && err.status === 401) {
        await this.repo.upsertSettings(userId, { enabled: false, disabledReason: 'invalid_token' });
        this.logger.warn(
          `[${SYNC_EVENT}] [fail] userId=${userId} durationMs=${Date.now() - startedAtMs} errorClass=TkHttpError error="invalid token" - TK token rejected; sync disabled`,
        );
        return;
      }
      this.logger.warn(
        `[${SYNC_EVENT}] [fail] userId=${userId} durationMs=${Date.now() - startedAtMs} errorClass=${err instanceof Error ? err.constructor.name : 'UnknownError'} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" - TK flush failed`,
      );
      throw err;
    }

    if (processedCount > 0) {
      this.logger.log(
        `[${SYNC_EVENT}] [end] userId=${userId} durationMs=${Date.now() - startedAtMs} itemCount=${processedCount} - TK flush completed`,
      );
    }
  }

  private async flushDay(client: TkMcpClient, userId: number, dateKey: string, dayItems: TkSyncItem[]): Promise<'written' | 'skipped'> {
    const existing = await client.callTool<TkDailyNoteResult>('get_daily_note', { date: dateKey, format: 'json' });

    if (!existing.found) {
      try {
        const created = await client.callTool<TkCreateDocumentResult>('create_daily_note', {
          date: dateKey,
          content: renderDayBlock(dayItems, true),
          tags: [...TK_TAGS],
        });
        await this.recordDay(userId, dateKey, created.id, dayItems);
        return 'written';
      } catch (err) {
        if (!(err instanceof TkRpcError && ALREADY_EXISTS_PATTERN.test(err.message))) throw err;
        // Race: another writer created the day's note between our get and our create. Fall
        // through to the edit path below using a fresh read of the now-existing note.
      }
    }

    const note = existing.found ? existing : await client.callTool<TkDailyNoteResult>('get_daily_note', { date: dateKey, format: 'json' });
    if (!note.found || !note.id || !note.content) throw new Error(`TK reported no daily note for ${dateKey} after create`);

    const remaining = dayItems.filter((item) => !noteContainsLinkTo(note.content!, item.url));
    if (remaining.length === 0) {
      // Everything is already written (a previous run crashed after the TK write but before the
      // ledger insert); just record the ledger for all of them without writing to TK again.
      await this.recordDay(userId, dateKey, note.id, dayItems);
      return 'written';
    }

    const anchor = findTkAnchor(note.content);
    if (anchor.anchorNodeId === null) {
      this.logger.warn(`[${SYNC_EVENT}] [fail] userId=${userId} dateKey=${dateKey} - daily note has no anchor node; skipping until it does`);
      return 'skipped';
    }

    try {
      await client.callTool('edit_document', {
        document_id: note.id,
        ops: [
          {
            type: 'insert_sibling_node',
            anchor_node_id: anchor.anchorNodeId,
            position: 'after',
            content: renderDayBlock(remaining, anchor.needsHeading),
          },
        ],
      });
    } catch (err) {
      if (err instanceof TkRpcError && SHARED_DOC_PATTERN.test(err.message)) {
        await this.repo.upsertSettings(userId, { disabledReason: 'daily_note_shared' });
        this.logger.warn(`[${SYNC_EVENT}] [fail] userId=${userId} dateKey=${dateKey} - daily note is shared; skipped`);
        return 'skipped';
      }
      throw err;
    }

    await this.recordDay(userId, dateKey, note.id, dayItems);
    return 'written';
  }

  private async recordDay(userId: number, dateKey: string, documentId: string, items: TkSyncItem[]): Promise<void> {
    const ledgerRows: TkLedgerInsert[] = items.map((item) => ({ kind: item.kind, sourceKey: item.sourceKey, dateKey, tkDocumentId: documentId }));
    const watermarks: TkWatermarkUpdate = { lastSyncedAt: new Date() };
    this.advanceWatermarks(watermarks, items);
    await this.repo.recordSyncedDay(userId, ledgerRows, watermarks);
  }

  private advanceWatermarks(watermarks: TkWatermarkUpdate, items: readonly TkSyncItem[]): void {
    for (const item of items) {
      if (item.kind === 'annotation') {
        const id = Number(item.sourceKey);
        watermarks.lastAnnotationId = Math.max(watermarks.lastAnnotationId ?? 0, id);
      } else if (item.kind === 'journal') {
        if (!watermarks.lastJournalCreatedAt || item.occurredAt > watermarks.lastJournalCreatedAt) watermarks.lastJournalCreatedAt = item.occurredAt;
      } else {
        if (!watermarks.lastFinishedAt || item.occurredAt > watermarks.lastFinishedAt) watermarks.lastFinishedAt = item.occurredAt;
      }
    }
  }

  /** Dry-run count for the settings page's "Backfill: N items across M days" preview. */
  async previewBackfill(userId: number): Promise<{ itemCount: number; dayCount: number; oldestDateKey: string | null }> {
    const settings = await this.repo.findSettings(userId);
    if (!settings) return { itemCount: 0, dayCount: 0, oldestDateKey: null };
    const items = await this.collectPendingItems(userId, settings, true);
    const dateKeys = [...groupItemsByDateKey(items).keys()];
    return { itemCount: items.length, dayCount: dateKeys.length, oldestDateKey: dateKeys[0] ?? null };
  }

  private async collectPendingItems(
    userId: number,
    settings: {
      lastAnnotationId: number;
      lastJournalCreatedAt: Date | null;
      lastFinishedAt: Date | null;
      connectedAt: Date | null;
      backfillRequestedAt: Date | null;
      syncAnnotations: boolean;
      syncJournal: boolean;
      syncFinished: boolean;
    },
    forceAll: boolean,
  ): Promise<TkSyncItem[]> {
    const timezoneSource = await this.repo.findUserTimezone(userId);
    const timeZone = resolveTimeZone(timezoneSource, 'UTC');
    const appUrl = this.appConfiguration.appUrl;
    const backfilling = forceAll || Boolean(settings.backfillRequestedAt);

    const [annotations, journalEntries, finishedBooks] = await Promise.all([
      settings.syncAnnotations ? this.repo.findPendingAnnotations(userId, settings.lastAnnotationId, TK_FLUSH_PAGE_SIZE) : Promise.resolve([]),
      settings.syncJournal ? this.repo.findPendingJournalEntries(userId, settings.lastJournalCreatedAt, TK_FLUSH_PAGE_SIZE) : Promise.resolve([]),
      settings.syncFinished ? this.repo.findPendingFinishedBooks(userId, settings.lastFinishedAt, TK_FLUSH_PAGE_SIZE) : Promise.resolve([]),
    ]);

    const items: TkSyncItem[] = [
      ...annotations.map((row) => this.toAnnotationItem(row, appUrl, timeZone)),
      ...journalEntries.map((row) => this.toJournalItem(row, appUrl, timeZone)),
      ...finishedBooks.map((row) => this.toFinishedItem(row, appUrl, timeZone)),
    ];

    const eligible = backfilling || !settings.connectedAt ? items : items.filter((item) => item.occurredAt > settings.connectedAt!);

    const bySourceKey = new Map<string, TkSyncItem[]>();
    for (const item of eligible) {
      const bucket = bySourceKey.get(item.kind) ?? [];
      bucket.push(item);
      bySourceKey.set(item.kind, bucket);
    }
    const alreadySynced = await Promise.all(
      [...bySourceKey.entries()].map(async ([kind, kindItems]) => {
        const keys = await this.repo.findSyncedSourceKeys(
          userId,
          kind as TkSyncItem['kind'],
          kindItems.map((item) => item.sourceKey),
        );
        return [kind, keys] as const;
      }),
    );
    const syncedByKind = new Map(alreadySynced);
    return eligible.filter((item) => !syncedByKind.get(item.kind)?.has(item.sourceKey));
  }

  private toAnnotationItem(row: TkPendingAnnotationRow, appUrl: string, timeZone: string): TkSyncItem {
    return {
      kind: 'annotation',
      sourceKey: String(row.annotationId),
      dateKey: toDateKeyInTimeZone(row.createdAt, timeZone),
      occurredAt: row.createdAt,
      bookId: row.bookId,
      bookTitle: row.bookTitle ?? 'Untitled',
      bookAuthor: row.bookAuthor,
      text: row.text,
      note: row.note,
      url: bookOrbitTkAnnotationUrl(appUrl, row.bookId, row.annotationId),
    };
  }

  private toJournalItem(row: TkPendingJournalRow, appUrl: string, timeZone: string): TkSyncItem {
    return {
      kind: 'journal',
      sourceKey: row.clientId,
      dateKey: toDateKeyInTimeZone(row.createdAt, timeZone),
      occurredAt: row.createdAt,
      bookId: row.bookId,
      bookTitle: row.bookTitle ?? 'Untitled',
      bookAuthor: row.bookAuthor,
      body: row.body,
      quote: row.quote,
      url: bookOrbitTkBookUrl(appUrl, row.bookId),
    };
  }

  private toFinishedItem(row: TkPendingFinishedRow, appUrl: string, timeZone: string): TkSyncItem {
    return {
      kind: 'finished',
      sourceKey: `${row.bookId}:${row.finishedAt.toISOString()}`,
      dateKey: toDateKeyInTimeZone(row.finishedAt, timeZone),
      occurredAt: row.finishedAt,
      bookId: row.bookId,
      bookTitle: row.bookTitle ?? 'Untitled',
      bookAuthor: row.bookAuthor,
      rating: row.rating,
      url: bookOrbitTkBookUrl(appUrl, row.bookId),
    };
  }
}
