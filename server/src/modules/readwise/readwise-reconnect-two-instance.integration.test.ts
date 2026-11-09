/* eslint-disable @typescript-eslint/require-await -- stateful fakes implement real async interfaces synchronously, on purpose */
import { describe, expect, it } from 'vitest';

import type { ReadingServiceProvider, SyncRunProgressCounters } from '@bookorbit/types';

import { ReadingServiceRegistry } from '../reading-services/reading-service-registry.service';
import { ReadwiseBooksMigrationService } from './readwise-books-migration.service';
import type { LocalBookForMigration } from './readwise-books-local-books.repository';
import { ReadwiseSessionsPushService } from './readwise-sessions-push.service';
import { ReadwiseSessionsBackfillSweepService } from './readwise-sessions-backfill-sweep.service';
import { ReadwiseSessionsCorrectionService } from './readwise-sessions-correction.service';
import { ReadwiseSessionsDeleteUnlinkService } from './readwise-sessions-delete-unlink.service';
import { ReadwiseSessionsPullService } from './readwise-sessions-pull.service';
import { ReadwiseSessionsReconcileService } from './readwise-sessions-reconcile.service';
import { ReadwiseSessionsRepairService } from './readwise-sessions-repair.service';
import { ReadwiseSyncService } from './readwise-sync.service';
import type { ReadwiseBook, ReadwiseBookCreateItem, ReadwiseBookCreateResult, ReadwiseBookUpdateItem } from './readwise-books-client.service';
import type { ReadwiseCreateSessionItem } from './readwise-books-client.service';

/**
 * Two-instance reconnect-safety integration test for Readwise (S11 follow-up).
 *
 * `docs/AGENT_HANDOFF.md` S11 flagged "no stateful in-memory fake-remote integration test" as the
 * single biggest deferred item from the reconnect-safe sync task. This file is that test.
 *
 * Choice of harness: a real Postgres-backed two-instance test would need two independently
 * migrated databases (one per "instance") sharing nothing but a fake external account, which this
 * repo's e2e harness (`server/test/e2e/app-harness.ts`) does not support - it wires one NestJS app
 * onto one already-migrated database. Building that multi-database harness is out of scope for a
 * change confined to `server/src/modules/readwise` and `server/src/modules/hardcover`. Per the
 * task's explicit fallback, this test instead constructs the real service classes directly (the
 * same pattern every other `*.test.ts` file in this module already uses - see
 * `readwise-books-migration.service.test.ts`) against hand-rolled, but fully stateful, in-memory
 * fakes: one fake remote (shared, call-counted, exactly like a real Readwise account would be
 * shared by two app instances) and one fake local-DB layer (keyed by `userId`, exactly like the
 * real schema, so "instance A" and "instance B" are modelled as two different `userId`s acting on
 * the same book/session/highlight rows a snapshot-restore would otherwise duplicate across two
 * physical databases). Nothing here touches real Drizzle/SQL, so repository query correctness is
 * not exercised by this file - that is covered by each repository's dedicated unit tests.
 */

// ---------------------------------------------------------------------------
// Fake remote: shared Readwise account hit by both instances, call-counted.
// ---------------------------------------------------------------------------

interface RemoteBook {
  id: string;
  isbn13: string;
  title: string;
  author: string;
  status: ReadwiseBook['status'];
  rating: number | null;
  review: string | null;
  started_reading_at: string | null;
  finished_reading_at: string | null;
}

interface RemoteSession {
  id: string;
  book_id: string;
  started_at: string;
  ended_at: string;
  format: 'ebook' | 'audiobook' | 'paper';
  is_deleted: boolean;
}

class FakeReadwiseRemote {
  readonly books: RemoteBook[] = [];
  readonly sessions: RemoteSession[] = [];
  readonly highlights: { id: number; text: string; note: string | null }[] = [];
  private nextBookId = 1;
  private nextSessionId = 1;
  private nextHighlightId = 1;

  readonly calls = {
    createBooks: 0,
    updateBooks: 0,
    createSessions: 0,
    deleteSessions: 0,
    createHighlights: 0,
    updateHighlight: 0,
    deleteHighlight: 0,
  };

  // ---- Books client surface ----
  async listBooks() {
    return { results: this.books.map((b) => this.toApiBook(b)), next: null as string | null };
  }

  async createBooks(_userId: number, _token: string, items: ReadwiseBookCreateItem[]): Promise<ReadwiseBookCreateResult[]> {
    this.calls.createBooks += 1;
    return items.map((item) => {
      const book: RemoteBook = {
        id: `rwbook-${this.nextBookId++}`,
        isbn13: item.product.isbn ?? '',
        title: item.product.title ?? '',
        author: item.product.author ?? '',
        status: item.status ?? 'unsorted',
        rating: item.rating ?? null,
        review: item.review ?? null,
        started_reading_at: item.started_reading_at ?? null,
        finished_reading_at: item.finished_reading_at ?? null,
      };
      this.books.push(book);
      return { id: book.id, status: 'created' as const, book_id: book.id };
    });
  }

  async updateBooks(_userId: number, _token: string, items: ReadwiseBookUpdateItem[]): Promise<ReadwiseBookCreateResult[]> {
    this.calls.updateBooks += 1;
    return items.map((item) => {
      const book = this.books.find((b) => b.id === item.id);
      if (book) {
        if (item.status !== undefined) book.status = item.status;
        if (item.rating !== undefined) book.rating = item.rating;
        if (item.review !== undefined) book.review = item.review;
        if (item.started_reading_at !== undefined) book.started_reading_at = item.started_reading_at;
        if (item.finished_reading_at !== undefined) book.finished_reading_at = item.finished_reading_at;
      }
      return { id: item.id, status: 'existing' as const, book_id: item.id };
    });
  }

  async listSessions() {
    // Dataset is tiny and dedupe is ledger-driven, not cursor-driven, so a full re-list on every
    // call is enough to exercise the dedupe logic without faking Readwise's real pagination.
    return { results: this.sessions.map((s) => ({ ...s })), next: null as string | null };
  }

  async createSessions(_userId: number, _token: string, items: ReadwiseCreateSessionItem[]): Promise<{ id: string }[]> {
    this.calls.createSessions += 1;
    return items.map((item) => {
      const session: RemoteSession = {
        id: `rwsess-${this.nextSessionId++}`,
        book_id: item.book_id,
        started_at: item.started_at,
        ended_at: item.ended_at,
        format: item.format,
        is_deleted: false,
      };
      this.sessions.push(session);
      return { id: session.id };
    });
  }

  async deleteSessions(_userId: number, _token: string, ids: string[]): Promise<void> {
    this.calls.deleteSessions += 1;
    for (const id of ids) {
      const session = this.sessions.find((s) => s.id === id);
      if (session) session.is_deleted = true;
    }
  }

  // ---- Highlights (v2) client surface ----
  async createHighlights(_userId: number, _token: string, highlights: { text: string; note?: string }[]): Promise<number[]> {
    this.calls.createHighlights += 1;
    return highlights.map((h) => {
      const id = this.nextHighlightId++;
      this.highlights.push({ id, text: h.text, note: h.note ?? null });
      return id;
    });
  }

  async updateHighlight(): Promise<void> {
    this.calls.updateHighlight += 1;
  }

  async deleteHighlight(): Promise<void> {
    this.calls.deleteHighlight += 1;
  }

  /** Simulates an edit made directly in the Readwise app, independent of any BookOrbit push. */
  setRemoteRatingDirectly(bookId: string, rating: number): void {
    const book = this.books.find((b) => b.id === bookId);
    if (book) book.rating = rating;
  }

  /** Simulates a reading session logged directly in the Readwise app, with no BookOrbit twin. */
  addRemoteOnlySession(bookId: string, startedAt: Date, durationSeconds: number): RemoteSession {
    const session: RemoteSession = {
      id: `rwsess-${this.nextSessionId++}`,
      book_id: bookId,
      started_at: startedAt.toISOString(),
      ended_at: new Date(startedAt.getTime() + durationSeconds * 1000).toISOString(),
      format: 'ebook',
      is_deleted: false,
    };
    this.sessions.push(session);
    return session;
  }

  booksByIsbn(isbn13: string): RemoteBook[] {
    return this.books.filter((b) => b.isbn13 === isbn13);
  }

  private toApiBook(b: RemoteBook): ReadwiseBook {
    return {
      id: b.id,
      product: { isbn: b.isbn13, title: b.title, author: b.author },
      status: b.status,
      rating: b.rating,
      review: b.review,
      started_reading_at: b.started_reading_at,
      finished_reading_at: b.finished_reading_at,
    };
  }
}

// ---------------------------------------------------------------------------
// Fake local DB: one process-wide store, every method scoped by userId, the
// same way the real schema scopes books/annotations/sessions/ledger rows.
// ---------------------------------------------------------------------------

interface FakeAnnotation {
  annotationId: number;
  userId: number;
  bookId: number;
  text: string;
  note: string | null;
  createdAt: Date;
  title: string | null;
  isbn13: string | null;
  isbn10: string | null;
  author: string;
  deletedAt: Date | null;
}

interface FakeSession {
  id: number;
  userId: number;
  bookId: number;
  startedAt: Date;
  endedAt: Date;
  durationSeconds: number;
  source: 'local' | 'readwise';
}

interface FakeItemLink {
  userId: number;
  provider: ReadingServiceProvider;
  kind: string;
  localId: number;
  externalId: string;
  contentHash: string | null;
  deletedAt: Date | null;
}

interface FakeBookLink {
  userId: number;
  provider: ReadingServiceProvider;
  bookId: number;
  externalBookId: string;
  matchMethod: string;
  remoteDeleted?: boolean;
}

class FakeLocalDb {
  readonly books: LocalBookForMigration[] = [];
  readonly booksByUser = new Map<number, number[]>(); // userId -> bookIds it owns
  readonly annotations: FakeAnnotation[] = [];
  readonly sessions: FakeSession[] = [];
  readonly itemLinks: FakeItemLink[] = [];
  readonly bookLinks: FakeBookLink[] = [];
  readonly cache = new Map<string, unknown>();
  private nextAnnotationId = 1;
  private nextSessionId = 1;

  addBook(userId: number, book: LocalBookForMigration): void {
    this.books.push(book);
    const ids = this.booksByUser.get(userId) ?? [];
    ids.push(book.bookId);
    this.booksByUser.set(userId, ids);
  }

  findPage(userId: number, afterBookId: number, limit: number): LocalBookForMigration[] {
    const owned = new Set(this.booksByUser.get(userId) ?? []);
    return this.books
      .filter((b) => owned.has(b.bookId) && b.bookId > afterBookId)
      .sort((a, b) => a.bookId - b.bookId)
      .slice(0, limit);
  }

  addAnnotation(userId: number, bookId: number, text: string): FakeAnnotation {
    const row: FakeAnnotation = {
      annotationId: this.nextAnnotationId++,
      userId,
      bookId,
      text,
      note: null,
      createdAt: new Date(),
      title: null,
      isbn13: null,
      isbn10: null,
      author: '',
      deletedAt: null,
    };
    this.annotations.push(row);
    return row;
  }

  addSession(userId: number, bookId: number, startedAt: Date, durationSeconds: number): FakeSession {
    const row: FakeSession = {
      id: this.nextSessionId++,
      userId,
      bookId,
      startedAt,
      endedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
      durationSeconds,
      source: 'local',
    };
    this.sessions.push(row);
    return row;
  }

  private linkedLocalIds(userId: number, provider: ReadingServiceProvider, kind: string): Set<number> {
    return new Set(this.itemLinks.filter((l) => l.userId === userId && l.provider === provider && l.kind === kind).map((l) => l.localId));
  }

  // ---- highlights (ReadwiseRepository surface) ----
  findPushableHighlights(userId: number, limit: number) {
    const linked = this.linkedLocalIds(userId, 'readwise', 'highlight');
    return this.annotations
      .filter((a) => a.userId === userId && a.deletedAt === null && !linked.has(a.annotationId))
      .sort((a, b) => a.annotationId - b.annotationId)
      .slice(0, limit);
  }

  findChangedLinkedHighlights(userId: number, afterAnnotationId: number, limit: number) {
    const links = this.itemLinks.filter((l) => l.userId === userId && l.provider === 'readwise' && l.kind === 'highlight' && l.deletedAt === null);
    const byLocalId = new Map(links.map((l) => [l.localId, l]));
    return this.annotations
      .filter((a) => a.userId === userId && a.deletedAt === null && a.annotationId > afterAnnotationId && byLocalId.has(a.annotationId))
      .sort((a, b) => a.annotationId - b.annotationId)
      .slice(0, limit)
      .map((a) => ({ ...a, externalId: byLocalId.get(a.annotationId)!.externalId, contentHash: byLocalId.get(a.annotationId)!.contentHash }));
  }

  findDeletedLinkedHighlights(): { annotationId: number; externalId: string }[] {
    return [];
  }

  // ---- sessions (ReadwiseSessionsLocalRepository surface) ----
  findPushableSessions(userId: number, bookId: number, minDurationSeconds: number, limit: number) {
    const linked = this.linkedLocalIds(userId, 'readwise', 'session');
    return this.sessions
      .filter(
        (s) => s.userId === userId && s.bookId === bookId && s.source !== 'readwise' && s.durationSeconds >= minDurationSeconds && !linked.has(s.id),
      )
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .slice(0, limit);
  }

  findAllPushableSessions(userId: number, minDurationSeconds: number, afterId: number, limit: number) {
    const linked = this.linkedLocalIds(userId, 'readwise', 'session');
    return this.sessions
      .filter((s) => s.userId === userId && s.source !== 'readwise' && s.durationSeconds >= minDurationSeconds && s.id > afterId && !linked.has(s.id))
      .sort((a, b) => a.id - b.id)
      .slice(0, limit)
      .map((s) => ({ ...s }));
  }

  findUnlinkedSessionMatch(userId: number, bookId: number, startedAt: Date, durationSeconds: number, toleranceSeconds: number) {
    const linked = this.linkedLocalIds(userId, 'readwise', 'session');
    return this.sessions.find(
      (s) =>
        s.userId === userId &&
        s.bookId === bookId &&
        s.source !== 'readwise' &&
        !linked.has(s.id) &&
        Math.abs(s.startedAt.getTime() - startedAt.getTime()) / 1000 <= toleranceSeconds &&
        Math.abs(s.durationSeconds - durationSeconds) <= toleranceSeconds,
    );
  }

  insertPulledSession(userId: number, session: { externalId: string; bookId: number; startedAt: Date; endedAt: Date }) {
    const existingLink = this.itemLinks.find(
      (l) => l.userId === userId && l.provider === 'readwise' && l.kind === 'session' && l.externalId === session.externalId,
    );
    if (existingLink) return { id: existingLink.localId, inserted: false };

    const durationSeconds = Math.max(0, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000));
    const row: FakeSession = {
      id: this.nextSessionId++,
      userId,
      bookId: session.bookId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      durationSeconds,
      source: 'readwise',
    };
    this.sessions.push(row);
    this.itemLinks.push({
      userId,
      provider: 'readwise',
      kind: 'session',
      localId: row.id,
      externalId: session.externalId,
      contentHash: null,
      deletedAt: null,
    });
    return { id: row.id, inserted: true };
  }

  removePulledSession(userId: number, localId: number): void {
    const idx = this.sessions.findIndex((s) => s.userId === userId && s.id === localId && s.source === 'readwise');
    if (idx >= 0) this.sessions.splice(idx, 1);
    const link = this.itemLinks.find((l) => l.userId === userId && l.provider === 'readwise' && l.kind === 'session' && l.localId === localId);
    if (link) link.deletedAt = new Date();
  }

  // ---- reading-services ledger/book-link surface ----
  async upsertBookLink(
    userId: number,
    provider: ReadingServiceProvider,
    bookId: number,
    data: { externalBookId: string; matchMethod: string },
  ): Promise<void> {
    const existing = this.bookLinks.find((l) => l.userId === userId && l.provider === provider && l.bookId === bookId);
    if (existing) {
      existing.externalBookId = data.externalBookId;
      existing.matchMethod = data.matchMethod;
      return;
    }
    this.bookLinks.push({ userId, provider, bookId, externalBookId: data.externalBookId, matchMethod: data.matchMethod });
  }

  findBookLink(userId: number, provider: ReadingServiceProvider, bookId: number) {
    return this.bookLinks.find((l) => l.userId === userId && l.provider === provider && l.bookId === bookId);
  }

  findBookLinkByExternalId(userId: number, provider: ReadingServiceProvider, externalBookId: string) {
    return this.bookLinks.find((l) => l.userId === userId && l.provider === provider && l.externalBookId === externalBookId);
  }

  findBookLinksForProvider(userId: number, provider: ReadingServiceProvider) {
    return this.bookLinks.filter((l) => l.userId === userId && l.provider === provider);
  }

  recordItemLinks(
    items: { userId: number; provider: ReadingServiceProvider; kind: string; localId: number; externalId: string; contentHash?: string }[],
  ): void {
    for (const item of items) {
      const exists = this.itemLinks.some(
        (l) => l.userId === item.userId && l.provider === item.provider && l.kind === item.kind && l.localId === item.localId,
      );
      if (exists) continue;
      this.itemLinks.push({ ...item, contentHash: item.contentHash ?? null, deletedAt: null });
    }
  }

  findItemLinkByExternalId(userId: number, provider: ReadingServiceProvider, kind: string, externalId: string) {
    return this.itemLinks.find((l) => l.userId === userId && l.provider === provider && l.kind === kind && l.externalId === externalId);
  }

  markItemLinkDeleted(userId: number, provider: ReadingServiceProvider, kind: string, localId: number): void {
    const link = this.itemLinks.find((l) => l.userId === userId && l.provider === provider && l.kind === kind && l.localId === localId);
    if (link) link.deletedAt = new Date();
  }

  updateItemLinkContentHash(userId: number, provider: ReadingServiceProvider, kind: string, localId: number, contentHash: string): void {
    const link = this.itemLinks.find((l) => l.userId === userId && l.provider === provider && l.kind === kind && l.localId === localId);
    if (link) link.contentHash = contentHash;
  }

  // ---- cache (ReadingServiceCacheService surface) ----
  cacheGet<T>(userId: number, provider: string, key: string): T | null {
    return (this.cache.get(`${userId}:${provider}:${key}`) as T | undefined) ?? null;
  }

  cacheSet<T>(userId: number, provider: string, key: string, payload: T): void {
    this.cache.set(`${userId}:${provider}:${key}`, payload);
  }
}

// ---------------------------------------------------------------------------
// Wiring: construct the real services directly, pointed at the fakes above.
// ---------------------------------------------------------------------------

function buildHarness(remote: FakeReadwiseRemote, db: FakeLocalDb) {
  const booksClient = remote as unknown as import('./readwise-books-client.service').ReadwiseBooksClientService;
  const highlightsClient = remote as unknown as import('./readwise-client.service').ReadwiseClientService;

  const localBooksRepo = {
    findPage: (userId: number, afterBookId: number, limit: number) => Promise.resolve(db.findPage(userId, afterBookId, limit)),
  } as unknown as import('./readwise-books-local-books.repository').ReadwiseBooksLocalBooksRepository;

  const readwiseRepo = {
    findSettings: async () => ({ enabled: true, apiToken: 'tok', apiTokenEncrypted: null, disabledReason: null }) as any,
    upsertSettings: async () => undefined as any,
    userHasReadwiseSyncPermission: async () => true,
    findPushableHighlights: async (userId: number, limit: number) => db.findPushableHighlights(userId, limit),
    findChangedLinkedHighlights: async (userId: number, afterId: number, limit: number) => db.findChangedLinkedHighlights(userId, afterId, limit),
    findDeletedLinkedHighlights: async () => db.findDeletedLinkedHighlights(),
    findConnectedUserIds: async () => [] as number[],
  } as unknown as import('./readwise.repository').ReadwiseRepository;

  const tokenLike = { getToken: async () => 'tok' };
  const readwiseSettings = tokenLike as unknown as import('./readwise-settings.service').ReadwiseSettingsService;
  const readwiseTokens = tokenLike as unknown as import('./readwise-token.service').ReadwiseTokenService;

  const readingServicesRepo = {
    upsertBookLink: (userId: number, provider: ReadingServiceProvider, bookId: number, data: any) =>
      db.upsertBookLink(userId, provider, bookId, data),
    findBookLink: async (userId: number, provider: ReadingServiceProvider, bookId: number) => db.findBookLink(userId, provider, bookId),
    findBookLinkByExternalId: async (userId: number, provider: ReadingServiceProvider, externalBookId: string) =>
      db.findBookLinkByExternalId(userId, provider, externalBookId),
    findBookLinksForProvider: async (userId: number, provider: ReadingServiceProvider) => db.findBookLinksForProvider(userId, provider),
    recordItemLinks: async (items: any[]) => db.recordItemLinks(items),
    findItemLinkByExternalId: async (userId: number, provider: ReadingServiceProvider, kind: string, externalId: string) =>
      db.findItemLinkByExternalId(userId, provider, kind, externalId),
    markItemLinkDeleted: async (userId: number, provider: ReadingServiceProvider, kind: string, localId: number) =>
      db.markItemLinkDeleted(userId, provider, kind, localId),
    updateItemLinkContentHash: async (userId: number, provider: ReadingServiceProvider, kind: string, localId: number, hash: string) =>
      db.updateItemLinkContentHash(userId, provider, kind, localId, hash),
  } as unknown as import('../reading-services/reading-services.repository').ReadingServicesRepository;

  const cache = {
    get: async (userId: number, provider: string, key: string) => db.cacheGet(userId, provider, key),
    set: async (userId: number, provider: string, key: string, payload: unknown) => db.cacheSet(userId, provider, key, payload),
  } as unknown as import('../reading-services/reading-service-cache.service').ReadingServiceCacheService;

  const featuresService = {
    getFeatures: async () => ({}),
  } as unknown as import('../reading-services/reading-service-features.service').ReadingServiceFeaturesService;
  const libraryScopeService = {
    getEffectiveLibraryIdsForUserId: async () => [1],
  } as unknown as import('../reading-services/reading-service-library-scope.service').ReadingServiceLibraryScopeService;

  const sessionsRepo = {
    findPushableSessions: async (userId: number, bookId: number, minDuration: number, limit: number) =>
      db.findPushableSessions(userId, bookId, minDuration, limit),
    findAllPushableSessions: async (userId: number, minDuration: number, afterId: number, limit: number) =>
      db.findAllPushableSessions(userId, minDuration, afterId, limit),
    findUnlinkedSessionMatch: async (userId: number, bookId: number, startedAt: Date, durationSeconds: number, tolerance: number) =>
      db.findUnlinkedSessionMatch(userId, bookId, startedAt, durationSeconds, tolerance),
    insertPulledSession: async (userId: number, session: any) => db.insertPulledSession(userId, session),
    removePulledSession: async (userId: number, localId: number) => db.removePulledSession(userId, localId),
    resolveUserTimeZone: async () => 'UTC',
    // No previously-pushed sessions exist in this harness's dataset, so the one-time correction
    // pass always finds nothing to correct; this file exercises reconnect-safety, not correction.
    findLinkedSessionsForCorrection: async () => [] as never[],
    findLinkedSessionsForBook: async () => [] as never[],
    unlinkSessions: async () => undefined,
  } as unknown as import('./readwise-sessions-local.repository').ReadwiseSessionsLocalRepository;

  const registry = new ReadingServiceRegistry();
  const pullServiceStub = { pullForUser: async () => undefined } as unknown as import('./readwise-books-pull.service').ReadwiseBooksPullService;
  const ownedElsewhereStub = {
    getOwnedElsewhere: async () => [],
  } as unknown as import('./readwise-owned-elsewhere.service').ReadwiseOwnedElsewhereService;

  const migrationService = new ReadwiseBooksMigrationService(
    registry,
    booksClient,
    localBooksRepo,
    readwiseRepo,
    readwiseSettings,
    readingServicesRepo,
    cache,
    pullServiceStub,
    ownedElsewhereStub,
  );

  const syncRunServiceStub = {
    markReconciling: () => {},
    clearReconciling: () => {},
  } as unknown as import('../reading-services/reading-service-sync-run.service').ReadingServiceSyncRunService;

  const reconcileService = new ReadwiseSessionsReconcileService(
    booksClient,
    readwiseRepo,
    readingServicesRepo,
    cache,
    sessionsRepo,
    syncRunServiceStub,
  );
  const deleteUnlinkService = new ReadwiseSessionsDeleteUnlinkService(booksClient, sessionsRepo);
  const correctionService = new ReadwiseSessionsCorrectionService(sessionsRepo, readwiseRepo, cache, deleteUnlinkService);
  const repairService = new ReadwiseSessionsRepairService(sessionsRepo, readingServicesRepo, deleteUnlinkService);
  const sweepService = new ReadwiseSessionsBackfillSweepService(sessionsRepo, cache);
  // Fake, single-process stand-in for the real Postgres advisory lock: always free, since this
  // harness models two instances as two userIds, not two overlapping calls for the same userId.
  const advisoryLock = {
    runExclusive: async <T>(_operation: string, _userId: number, fn: () => Promise<T>) => fn(),
  } as unknown as import('../reading-services/reading-service-advisory-lock.service').ReadingServiceAdvisoryLockService;
  const sessionsPushService = new ReadwiseSessionsPushService(
    booksClient,
    sessionsRepo,
    readwiseRepo,
    readwiseSettings,
    readingServicesRepo,
    featuresService,
    reconcileService,
    correctionService,
    repairService,
    sweepService,
    advisoryLock,
  );
  const sessionsPullService = new ReadwiseSessionsPullService(
    booksClient,
    readwiseRepo,
    readwiseSettings,
    readingServicesRepo,
    featuresService,
    cache,
    sessionsRepo,
    advisoryLock,
  );

  const ledgerBackfillStub = {
    backfill: async () => undefined,
  } as unknown as import('./readwise-highlights-ledger-backfill.service').ReadwiseHighlightsLedgerBackfillService;
  const syncService = new ReadwiseSyncService(
    readwiseRepo,
    highlightsClient,
    readwiseTokens,
    readingServicesRepo,
    cache,
    ledgerBackfillStub,
    libraryScopeService,
    { appUrl: 'http://localhost:3000' } as any,
  );

  return { migrationService, sessionsPushService, sessionsPullService, syncService };
}

function emptyCounters(): SyncRunProgressCounters {
  return { scanned: 0, matched: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
}

async function runMigration(harness: ReturnType<typeof buildHarness>, userId: number): Promise<void> {
  let cursor: Record<string, unknown> | null = {};
  const counters = emptyCounters();
  for (let guard = 0; guard < 50 && cursor !== null; guard++) {
    cursor = await harness.migrationService.migratePage(userId, cursor, counters);
  }
}

async function runCycle(harness: ReturnType<typeof buildHarness>, userId: number, bookId: number): Promise<void> {
  await runMigration(harness, userId);
  await harness.sessionsPushService.flushUser(userId, [bookId]);
  await harness.sessionsPullService.pullForUser(userId);
  await harness.syncService.flush(userId);
}

const ISBN = '9780593099322';
const USER_A = 2001;
const USER_B = 2002;

function book(userId: number, bookId: number, overrides: Partial<LocalBookForMigration> = {}): LocalBookForMigration {
  return {
    bookId,
    isbn13: ISBN,
    isbn10: null,
    title: 'Dune',
    author: 'Frank Herbert',
    status: 'reading',
    rating: null,
    review: null,
    startedAt: '2026-01-01T00:00:00Z',
    finishedAt: null,
    ...overrides,
  };
}

describe('Readwise reconnect-safe sync: two instances, one remote account', () => {
  it('instance A syncs first, then instance B (same snapshot + its own local changes) reconnects without duplicating anything', async () => {
    const remote = new FakeReadwiseRemote();
    const db = new FakeLocalDb();
    const harness = buildHarness(remote, db);

    // ---- Instance A: first sync from an earlier snapshot ----
    const bookA = book(USER_A, 1, { rating: 4 });
    db.addBook(USER_A, bookA);
    await runMigration(harness, USER_A);
    const linkA = db.findBookLink(USER_A, 'readwise', bookA.bookId);
    expect(linkA).toBeTruthy();
    const remoteBookId = linkA!.externalBookId;
    expect(remote.booksByIsbn(ISBN)).toHaveLength(1);
    expect(remote.books.find((b) => b.id === remoteBookId)?.rating).toBe(4);

    const t0 = new Date('2026-01-01T10:00:00.000Z');
    const sharedSession = db.addSession(USER_A, bookA.bookId, t0, 1800);
    await harness.sessionsPushService.flushUser(USER_A, [bookA.bookId]);
    expect(remote.calls.createSessions).toBe(1);
    expect(remote.sessions).toHaveLength(1);

    db.addAnnotation(USER_A, bookA.bookId, 'Highlight A');
    await harness.syncService.flush(USER_A);
    expect(remote.calls.createHighlights).toBe(1);
    expect(remote.highlights).toHaveLength(1);

    // ---- Remote-side changes made independently (e.g. in the Readwise mobile app) ----
    remote.setRemoteRatingDirectly(remoteBookId, 2);
    const remoteOnlySession = remote.addRemoteOnlySession(remoteBookId, new Date(t0.getTime() + 2 * 3600_000), 900);

    // ---- Instance B: fresh install from the same snapshot, plus its own local changes ----
    const bookB = book(USER_B, 2, { rating: 5 }); // local change: rating differs from both A's push and the app-side edit
    db.addBook(USER_B, bookB);
    // Same underlying session as A already pushed (it is the same snapshot S) - must reconcile, not duplicate.
    const reconciledSession = db.addSession(USER_B, bookB.bookId, t0, 1800);
    // Genuinely new local session B recorded itself.
    const newSessionB = db.addSession(USER_B, bookB.bookId, new Date(t0.getTime() + 4 * 3600_000), 1200);
    db.addAnnotation(USER_B, bookB.bookId, 'Highlight B');

    await runCycle(harness, USER_B, bookB.bookId);

    // No duplicate remote book: still exactly one book for this ISBN, and B's local rating won.
    expect(remote.booksByIsbn(ISBN)).toHaveLength(1);
    expect(remote.books.find((b) => b.id === remoteBookId)?.rating).toBe(5);

    // No duplicate remote session for the reconciled one: only B's genuinely new session was created.
    expect(remote.calls.createSessions).toBe(2); // 1 from A, 1 from B's new session
    expect(remote.sessions).toHaveLength(3); // A's, the remote-only one, B's new one

    const reconciledLink = db.itemLinks.find(
      (l) => l.userId === USER_B && l.provider === 'readwise' && l.kind === 'session' && l.localId === reconciledSession.id,
    );
    expect(reconciledLink?.externalId).toBe(remote.sessions.find((s) => s.book_id === remoteBookId && s.started_at === t0.toISOString())!.id);

    const newSessionLink = db.itemLinks.find((l) => l.userId === USER_B && l.kind === 'session' && l.localId === newSessionB.id);
    expect(newSessionLink).toBeTruthy();

    // A's remote-side addition (the Readwise-app session) imported into B exactly once, and the
    // pulled row never carries a reading position/progress BookOrbit didn't set itself.
    const importedRows = db.sessions.filter((s) => s.userId === USER_B && s.source === 'readwise');
    expect(importedRows).toHaveLength(1);
    expect(importedRows[0]!.startedAt.toISOString()).toBe(remoteOnlySession.started_at);
    expect((importedRows[0] as any).endProgress ?? null).toBeNull();

    // A's own pushed session was not re-imported into B as a second row (it was reconciled/linked instead).
    expect(db.sessions.filter((s) => s.userId === USER_B)).toHaveLength(3); // B's original 2 + the one import

    // No duplicate remote highlight: A's and B's highlights are both distinct content, both created once.
    expect(remote.calls.createHighlights).toBe(2);
    expect(remote.highlights).toHaveLength(2);

    // ---- Second cycle for B: must be fully idempotent (zero mutating calls) ----
    const callsBefore = { ...remote.calls };
    await runCycle(harness, USER_B, bookB.bookId);
    expect(remote.calls).toEqual(callsBefore);
    expect(remote.books).toHaveLength(1);
    expect(remote.sessions).toHaveLength(3);
    expect(remote.highlights).toHaveLength(2);

    // Sanity: A's own original session row is untouched by anything B did.
    expect(db.sessions.find((s) => s.id === sharedSession.id)?.userId).toBe(USER_A);
  });

  it('a never-synced instance behaves like a normal first migration: everything is created exactly once', async () => {
    const remote = new FakeReadwiseRemote();
    const db = new FakeLocalDb();
    const harness = buildHarness(remote, db);

    const userId = 3001;
    const bookC = book(userId, 1, { rating: 3 });
    db.addBook(userId, bookC);
    db.addSession(userId, bookC.bookId, new Date('2026-02-01T09:00:00.000Z'), 1500);
    db.addAnnotation(userId, bookC.bookId, 'Highlight C');

    await runCycle(harness, userId, bookC.bookId);

    expect(remote.calls.createBooks).toBe(1);
    expect(remote.calls.createSessions).toBe(1);
    expect(remote.calls.createHighlights).toBe(1);
    expect(remote.books).toHaveLength(1);
    expect(remote.sessions).toHaveLength(1);
    expect(remote.highlights).toHaveLength(1);

    const callsAfterFirstSync = { ...remote.calls };
    await runCycle(harness, userId, bookC.bookId);
    expect(remote.calls).toEqual(callsAfterFirstSync);
  });
});
