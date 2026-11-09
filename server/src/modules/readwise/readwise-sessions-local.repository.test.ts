import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readingServiceItemLinks, readingSessions, userReadingDailyStats } from '../../db/schema';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';

function makeDbHarness(options?: { libraryRow?: { libraryId: number } | null; insertedSessionIds?: Array<{ id: number }> }) {
  const libraryRow = options?.libraryRow === undefined ? { libraryId: 9 } : options.libraryRow;
  const insertedSessionIds = options?.insertedSessionIds ?? [{ id: 500 }];

  const bookLimit = vi.fn().mockResolvedValue(libraryRow == null ? [] : [libraryRow]);
  const bookWhere = vi.fn().mockReturnValue({ limit: bookLimit });
  const bookFrom = vi.fn().mockReturnValue({ where: bookWhere });
  const select = vi.fn().mockReturnValue({ from: bookFrom });

  const sessionReturning = vi.fn().mockResolvedValue(insertedSessionIds);
  const sessionConflict = vi.fn().mockReturnValue({ returning: sessionReturning });
  const sessionValues = vi.fn().mockReturnValue({ onConflictDoNothing: sessionConflict });

  const ledgerConflict = vi.fn().mockResolvedValue(undefined);
  const ledgerValues = vi.fn().mockReturnValue({ onConflictDoNothing: ledgerConflict });

  const dailyConflictUpdate = vi.fn().mockResolvedValue(undefined);
  const dailyValues = vi.fn().mockReturnValue({ onConflictDoUpdate: dailyConflictUpdate });

  const txInsert = vi.fn((table: unknown) => {
    if (table === readingSessions) return { values: sessionValues };
    if (table === readingServiceItemLinks) return { values: ledgerValues };
    if (table === userReadingDailyStats) return { values: dailyValues };
    throw new Error('Unexpected table in insert');
  });

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const txDelete = vi.fn().mockReturnValue({ where: deleteWhere });

  const updateWhere = vi.fn().mockResolvedValue(undefined);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const txUpdate = vi.fn().mockReturnValue({ set: updateSet });

  const tx = { insert: txInsert, delete: txDelete, update: txUpdate, select };
  const transaction = vi.fn(async (callback: (trx: typeof tx) => Promise<unknown>) => callback(tx));

  const db = { select, transaction };
  const repo = new ReadwiseSessionsLocalRepository(db as never);

  return {
    repo,
    select,
    transaction,
    sessionValues,
    sessionConflict,
    ledgerValues,
    ledgerConflict,
    dailyValues,
    txDelete,
    deleteWhere,
    txUpdate,
    updateSet,
    updateWhere,
  };
}

describe('ReadwiseSessionsLocalRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('inserts the pulled session and its ledger row in one transaction, with no position fields', async () => {
    const { repo, transaction, sessionValues, ledgerValues, dailyValues } = makeDbHarness();

    const result = await repo.insertPulledSession(
      1,
      { externalId: 'ext-1', bookId: 42, startedAt: new Date('2026-01-01T00:00:00Z'), endedAt: new Date('2026-01-01T00:10:00Z'), format: 'ebook' },
      'UTC',
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(sessionValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        bookId: 42,
        bookFileId: null,
        source: 'readwise',
        sessionId: 'readwise:ext-1',
        progressDelta: null,
        endProgress: null,
      }),
    );
    expect(ledgerValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 1, provider: 'readwise', kind: 'session', localId: 500, externalId: 'ext-1' }),
    );
    expect(dailyValues).toHaveBeenCalled();
    expect(result).toEqual({ id: 500, inserted: true });
  });

  it('returns not-inserted when the book has no library (defensive, book not found)', async () => {
    const { repo, transaction } = makeDbHarness({ libraryRow: null });

    const result = await repo.insertPulledSession(
      1,
      { externalId: 'ext-2', bookId: 999, startedAt: new Date(), endedAt: new Date(), format: 'ebook' },
      'UTC',
    );

    expect(transaction).not.toHaveBeenCalled();
    expect(result).toEqual({ id: -1, inserted: false });
  });

  it('removes the local session and marks the ledger entry deleted, scoped to this user and localId', async () => {
    const { repo, transaction, txDelete, deleteWhere, txUpdate, updateSet, updateWhere } = makeDbHarness();

    await repo.removePulledSession(1, 500);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(txDelete).toHaveBeenCalledWith(readingSessions);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(txUpdate).toHaveBeenCalledWith(readingServiceItemLinks);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }));
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it('unlinkSessions soft-deletes the readwise session links for the given local ids', async () => {
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    const update = vi.fn().mockReturnValue({ set: updateSet });
    const db = { update } as never;
    const repo = new ReadwiseSessionsLocalRepository(db);

    await repo.unlinkSessions(1, [100, 101]);

    expect(update).toHaveBeenCalledWith(readingServiceItemLinks);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }));
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it('unlinkSessions is a no-op for an empty id list', async () => {
    const update = vi.fn();
    const db = { update } as never;
    const repo = new ReadwiseSessionsLocalRepository(db);

    await repo.unlinkSessions(1, []);

    expect(update).not.toHaveBeenCalled();
  });
});
