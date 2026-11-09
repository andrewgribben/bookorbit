/* eslint-disable @typescript-eslint/require-await -- stateful fakes implement real async interfaces synchronously, on purpose */
import { describe, expect, it } from 'vitest';

import { HardcoverSyncService } from './hardcover-sync.service';
import { HARDCOVER_PRIVACY, HARDCOVER_STATUS } from './hardcover.constants';
import type { BookSyncData } from './hardcover.repository';

/**
 * Two-instance reconnect-safety integration test for Hardcover (S11 follow-up companion to the
 * Readwise one in `../readwise/readwise-reconnect-two-instance.integration.test.ts` - see that
 * file's header comment for why this constructs real services directly against stateful fakes
 * instead of a real Postgres-backed two-database harness).
 *
 * `docs/AGENT_HANDOFF.md` S11 audited Hardcover as low duplicate-risk because `user_book` is
 * always looked up by Hardcover's own `book_id` before a create, and reading-journal (`read`)
 * writes are scoped to that same looked-up `user_book` - "confirmed by reading
 * `hardcover-sync.service.ts` end to end", but with no integration test proving it across two
 * instances sharing one account. This file is that proof: two BookOrbit "instances" (two userIds,
 * one HardcoverBookMatchService stubbed to resolve both to the same Hardcover book, per the
 * S11 audit's own scope - matching logic itself has its own dedicated test file) syncing against
 * one shared, call-counted fake Hardcover account.
 */

interface RemoteUserBook {
  id: number;
  statusId: number;
  rating: number | null;
  privacySettingId: number;
  editionId: number | null;
}

interface RemoteRead {
  id: number;
  started_at: string | null;
  finished_at: string | null;
  progress_pages: number | null;
  progress_seconds: number | null;
}

class FakeHardcoverRemote {
  readonly userBooksByBookId = new Map<number, RemoteUserBook>();
  readonly readsByUserBookId = new Map<number, RemoteRead[]>();
  private nextUserBookId = 1;
  private nextReadId = 1;

  readonly calls = { insertUserBook: 0, updateUserBook: 0, findUserBook: 0, insertRead: 0, updateRead: 0 };

  async query<T>(_userId: number, _token: string, queryText: string, variables: Record<string, unknown> = {}): Promise<T> {
    if (queryText.includes('InsertUserBookRead')) return this.insertRead(variables) as T;
    if (queryText.includes('UpdateUserBookRead')) return this.updateRead(variables) as T;
    if (queryText.includes('FindUserBookReadOwner')) return this.findReadOwner(variables) as T;
    if (queryText.includes('FindUserBookReads')) return this.findReads(variables) as T;
    if (queryText.includes('InsertUserBook')) return this.insertUserBook(variables) as T;
    if (queryText.includes('UpdateUserBook')) return this.updateUserBook(variables) as T;
    if (queryText.includes('FindUserBook')) return this.findUserBook(variables) as T;
    throw new Error(`FakeHardcoverRemote: unrecognised query\n${queryText}`);
  }

  private insertUserBook(variables: Record<string, unknown>) {
    this.calls.insertUserBook += 1;
    const object = variables.object as { book_id: number; status_id: number; privacy_setting_id: number; edition_id?: number };
    const existing = this.userBooksByBookId.get(object.book_id);
    if (existing) {
      // Mirrors Hardcover rejecting a second user_book for a book the account already owns;
      // the real sync code falls back to FindUserBook on this shape (see hardcover-sync.service).
      return { insert_user_book: { user_book: null, error: 'already exists' } };
    }
    const row: RemoteUserBook = {
      id: this.nextUserBookId++,
      statusId: object.status_id,
      rating: null,
      privacySettingId: object.privacy_setting_id,
      editionId: object.edition_id ?? null,
    };
    this.userBooksByBookId.set(object.book_id, row);
    return { insert_user_book: { user_book: { id: row.id }, error: null } };
  }

  private findUserBook(variables: Record<string, unknown>) {
    this.calls.findUserBook += 1;
    const bookId = variables.bookId as number;
    const existing = this.userBooksByBookId.get(bookId);
    return { me: { user_books: existing ? [{ id: existing.id }] : [] } };
  }

  private updateUserBook(variables: Record<string, unknown>) {
    this.calls.updateUserBook += 1;
    const id = variables.id as number;
    const object = variables.object as { status_id?: number; rating?: number; privacy_setting_id?: number; edition_id?: number };
    const row = this.findUserBookRowById(id);
    if (row) {
      if (object.status_id !== undefined) row.statusId = object.status_id;
      if (object.rating !== undefined) row.rating = object.rating;
      if (object.privacy_setting_id !== undefined) row.privacySettingId = object.privacy_setting_id;
      if (object.edition_id !== undefined) row.editionId = object.edition_id;
    }
    return { update_user_book: { user_book: { id }, error: null } };
  }

  private insertRead(variables: Record<string, unknown>) {
    this.calls.insertRead += 1;
    const userBookId = variables.userBookId as number;
    const object = variables.object as Record<string, unknown>;
    const read: RemoteRead = {
      id: this.nextReadId++,
      started_at: (object.started_at as string) ?? null,
      finished_at: (object.finished_at as string) ?? null,
      progress_pages: (object.progress_pages as number) ?? null,
      progress_seconds: (object.progress_seconds as number) ?? null,
    };
    const bucket = this.readsByUserBookId.get(userBookId) ?? [];
    bucket.push(read);
    this.readsByUserBookId.set(userBookId, bucket);
    return { insert_user_book_read: { user_book_read: { id: read.id }, error: null } };
  }

  private updateRead(variables: Record<string, unknown>) {
    this.calls.updateRead += 1;
    const id = variables.id as number;
    const object = variables.object as Record<string, unknown>;
    for (const bucket of this.readsByUserBookId.values()) {
      const read = bucket.find((r) => r.id === id);
      if (read) {
        if ('started_at' in object) read.started_at = object.started_at as string;
        if ('finished_at' in object) read.finished_at = object.finished_at as string;
        if ('progress_pages' in object) read.progress_pages = object.progress_pages as number;
        if ('progress_seconds' in object) read.progress_seconds = object.progress_seconds as number;
      }
    }
    return { update_user_book_read: { user_book_read: { id }, error: null } };
  }

  private findReads(variables: Record<string, unknown>) {
    const userBookId = variables.userBookId as number;
    const reads = [...(this.readsByUserBookId.get(userBookId) ?? [])].sort((a, b) => b.id - a.id).slice(0, 20);
    return { user_book_reads: reads };
  }

  private findReadOwner(variables: Record<string, unknown>) {
    const id = variables.id as number;
    for (const [userBookId, bucket] of this.readsByUserBookId.entries()) {
      if (bucket.some((r) => r.id === id)) return { user_book_reads: [{ id, user_book_id: userBookId }] };
    }
    return { user_book_reads: [] };
  }

  private findUserBookRowById(id: number): RemoteUserBook | undefined {
    for (const row of this.userBooksByBookId.values()) {
      if (row.id === id) return row;
    }
    return undefined;
  }

  userBooksForBook(bookId: number): RemoteUserBook[] {
    const row = this.userBooksByBookId.get(bookId);
    return row ? [row] : [];
  }
}

interface FakeAttempt {
  id: number;
  startedOn: string | null;
  endedOn: string | null;
  outcome: 'completed' | null;
  externalProvider: string | null;
  externalId: string | null;
}

class FakeHardcoverLocalRepo {
  private bookStates = new Map<string, Record<string, unknown>>();
  private bookSyncRows = new Map<string, BookSyncData>();
  private attempts: FakeAttempt[] = [];
  private nextAttemptId = 1;

  private key(userId: number, bookId: number): string {
    return `${userId}:${bookId}`;
  }

  addAttempt(startedOn: string | null, endedOn: string | null, outcome: 'completed' | null): FakeAttempt {
    const attempt: FakeAttempt = { id: this.nextAttemptId++, startedOn, endedOn, outcome, externalProvider: null, externalId: null };
    this.attempts.push(attempt);
    return attempt;
  }

  setBookSyncData(userId: number, data: BookSyncData): void {
    this.bookSyncRows.set(this.key(userId, data.bookId), data);
  }

  async findBookSyncData(userId: number, bookId: number): Promise<BookSyncData | undefined> {
    return this.bookSyncRows.get(this.key(userId, bookId));
  }

  async findBookState(userId: number, bookId: number) {
    return this.bookStates.get(this.key(userId, bookId)) as any;
  }

  async findBookStatesByBookIds(userId: number, bookIds: number[]) {
    return bookIds.map((id) => this.bookStates.get(this.key(userId, id))).filter(Boolean) as any[];
  }

  async upsertBookState(data: Record<string, unknown>) {
    const k = this.key(data.userId as number, data.bookId as number);
    const merged = { ...(this.bookStates.get(k) ?? {}), ...data };
    this.bookStates.set(k, merged);
    return merged as any;
  }

  async findReadingAttempts() {
    return this.attempts.map((a) => ({ ...a }));
  }

  async findClaimedHardcoverReadIds(): Promise<number[]> {
    return this.attempts
      .filter((a) => a.externalProvider === 'hardcover' && a.externalId)
      .map((a) => Number(a.externalId))
      .filter((n) => Number.isInteger(n) && n > 0);
  }

  async linkReadingAttempt(_userId: number, attemptId: number, readId: number): Promise<'linked' | 'conflict'> {
    const attempt = this.attempts.find((a) => a.id === attemptId);
    if (attempt) {
      attempt.externalProvider = 'hardcover';
      attempt.externalId = String(readId);
    }
    return 'linked';
  }

  async unlinkReadingAttempt(_userId: number, attemptId: number): Promise<void> {
    const attempt = this.attempts.find((a) => a.id === attemptId);
    if (attempt) {
      attempt.externalProvider = null;
      attempt.externalId = null;
    }
  }

  async updateLastSyncedAt(): Promise<void> {}
  async findSyncableBooks(): Promise<BookSyncData[]> {
    return [];
  }
}

const HARDCOVER_BOOK_ID = 500;
const HARDCOVER_EDITION_ID = 600;
const LIBRARY_ID = 1;

function makeMatchService() {
  return {
    matchBook: async () => ({
      hardcoverBookId: HARDCOVER_BOOK_ID,
      hardcoverEditionId: HARDCOVER_EDITION_ID,
      editionPages: 300,
      editionAudioSeconds: null,
      matchMethod: 'isbn' as const,
      replacedHardcoverBookId: null,
    }),
  } as any;
}

function makeSettingsService(token = 'tok') {
  return {
    getTokenForUser: async () => token,
    getSettings: async () => ({
      tokenConfigured: true,
      enabled: true,
      effectiveEnabled: true,
      disabledReason: null,
      bookSyncMode: 'all_eligible',
      autoSyncOnStatusChange: true,
      autoSyncOnProgressUpdate: true,
      autoSyncOnRatingChange: true,
      privacySettingId: HARDCOVER_PRIVACY.PRIVATE,
      lastSyncedAt: null,
    }),
  } as any;
}

function makeLibraryScopeService() {
  return { getEffectiveLibraryIdsForUserId: async () => [LIBRARY_ID] } as any;
}

function bookSyncData(bookId: number, overrides: Partial<BookSyncData> = {}): BookSyncData {
  return {
    bookId,
    libraryId: LIBRARY_ID,
    isbn13: '9780593099322',
    isbn10: null,
    title: 'Dune',
    authorName: 'Frank Herbert',
    hardcoverMetadataId: null,
    pageCount: 412,
    format: 'epub',
    status: 'reading',
    startedAt: new Date('2026-01-01T00:00:00Z'),
    finishedAt: null,
    rating: null,
    progress: null,
    attemptsUpdatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function buildSyncService(remote: FakeHardcoverRemote, localRepo: FakeHardcoverLocalRepo) {
  return new HardcoverSyncService(
    localRepo as any,
    remote as any,
    makeMatchService(),
    makeSettingsService(),
    {} as any, // BookService: unused by syncBook/syncSingleBook
    makeLibraryScopeService(),
  );
}

describe('Hardcover reconnect-safe sync: two instances, one remote account', () => {
  it('instance A syncs first, then instance B (same remote book, its own local changes) reconnects without duplicating the user_book', async () => {
    const remote = new FakeHardcoverRemote();
    const USER_A = 2001;
    const USER_B = 2002;
    const BOOK_A = 1;
    const BOOK_B = 2;

    // ---- Instance A: first sync from an earlier snapshot ----
    const repoA = new FakeHardcoverLocalRepo();
    const serviceA = buildSyncService(remote, repoA);
    repoA.addAttempt('2026-01-01', null, null); // open attempt: still reading, not finished
    repoA.setBookSyncData(USER_A, bookSyncData(BOOK_A, { status: 'reading', rating: 4 }));

    const resultA = await serviceA.syncBook(USER_A, BOOK_A);
    expect(resultA).toBe('synced');
    expect(remote.calls.insertUserBook).toBe(1);
    expect(remote.userBooksForBook(HARDCOVER_BOOK_ID)).toHaveLength(1);
    expect(remote.userBooksForBook(HARDCOVER_BOOK_ID)[0]!.rating).toBe(4);
    const remoteUserBookId = remote.userBooksForBook(HARDCOVER_BOOK_ID)[0]!.id;
    expect(remote.readsByUserBookId.get(remoteUserBookId)).toHaveLength(1);

    // Running A's sync again with nothing changed must be a no-op (no new remote calls).
    const callsAfterA = { ...remote.calls };
    const resultARerun = await serviceA.syncBook(USER_A, BOOK_A);
    expect(resultARerun).toBe('skipped');
    expect(remote.calls).toEqual(callsAfterA);

    // ---- Remote-side edit made independently (e.g. directly in the Hardcover app) ----
    remote.userBooksForBook(HARDCOVER_BOOK_ID)[0]!.rating = 1;

    // ---- Instance B: fresh install, same remote book (same ISBN), its own local changes ----
    const repoB = new FakeHardcoverLocalRepo();
    const serviceB = buildSyncService(remote, repoB);
    repoB.addAttempt('2026-01-01', '2026-01-10', 'completed'); // B's own attempt: finished, different dates
    repoB.setBookSyncData(
      USER_B,
      bookSyncData(BOOK_B, { status: 'read', rating: 5, startedAt: new Date('2026-01-01'), finishedAt: new Date('2026-01-10') }),
    );

    const resultB = await serviceB.syncBook(USER_B, BOOK_B);
    expect(resultB).toBe('synced');

    // No duplicate user_book for the shared Hardcover book: B's insert hit the existing row via
    // the find-fallback path, never created a second one.
    expect(remote.userBooksForBook(HARDCOVER_BOOK_ID)).toHaveLength(1);
    expect(remote.calls.findUserBook).toBe(1);

    // B's local rating wins on the remote: neither A's original 4 nor the app-side edit (1) survives.
    expect(remote.userBooksForBook(HARDCOVER_BOOK_ID)[0]!.rating).toBe(5);
    expect(remote.userBooksForBook(HARDCOVER_BOOK_ID)[0]!.statusId).toBe(HARDCOVER_STATUS.READ);

    // B's own reading attempt became its own read entry on the shared user_book (not a duplicate
    // user_book, and not a collision with A's still-open read for the same book).
    const reads = remote.readsByUserBookId.get(remoteUserBookId) ?? [];
    expect(reads).toHaveLength(2);
    expect(reads.filter((r) => r.finished_at !== null)).toHaveLength(1);
    expect(reads.filter((r) => r.finished_at === null)).toHaveLength(1);

    // ---- Second cycle for B: nothing changed, so it must be a no-op (zero mutating calls) ----
    const callsAfterB = { ...remote.calls };
    const resultBRerun = await serviceB.syncBook(USER_B, BOOK_B);
    expect(resultBRerun).toBe('skipped');
    expect(remote.calls).toEqual(callsAfterB);
  });

  it('a never-synced instance behaves like a normal first sync: the user_book is created exactly once', async () => {
    const remote = new FakeHardcoverRemote();
    const repo = new FakeHardcoverLocalRepo();
    const service = buildSyncService(remote, repo);
    const userId = 3001;
    const bookId = 1;
    repo.addAttempt('2026-02-01', null, null);
    repo.setBookSyncData(userId, bookSyncData(bookId, { status: 'reading', rating: 3 }));

    const result = await service.syncBook(userId, bookId);
    expect(result).toBe('synced');
    expect(remote.calls.insertUserBook).toBe(1);
    expect(remote.userBooksForBook(HARDCOVER_BOOK_ID)).toHaveLength(1);

    const callsAfterFirstSync = { ...remote.calls };
    const rerun = await service.syncBook(userId, bookId);
    expect(rerun).toBe('skipped');
    expect(remote.calls).toEqual(callsAfterFirstSync);
  });
});
