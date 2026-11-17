import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@bookorbit/types';

import { TkRepository } from './tk.repository';

function makeChain(terminal: Record<string, unknown>) {
  const chain: Record<string, unknown> = { ...terminal };
  for (const method of ['from', 'leftJoin', 'innerJoin', 'where', 'groupBy', 'orderBy']) {
    if (!(method in chain)) chain[method] = vi.fn().mockReturnValue(chain);
  }
  return chain;
}

function makeSelectChain(rows: unknown[]) {
  return makeChain({ limit: vi.fn().mockResolvedValue(rows) });
}

function makeReturningChain(rows: unknown[]) {
  const chain = { values: vi.fn(), onConflictDoUpdate: vi.fn(), onConflictDoNothing: vi.fn(), returning: vi.fn() };
  chain.values.mockReturnValue(chain);
  chain.onConflictDoUpdate.mockReturnValue(chain);
  chain.onConflictDoNothing.mockReturnValue(chain);
  chain.returning.mockResolvedValue(rows);
  return chain;
}

function makeRepository() {
  const settingsRow = { id: 1, userId: 7, enabled: true, disabledReason: null };
  const settingsQuery = { findFirst: vi.fn().mockResolvedValue(settingsRow) };
  const settingsInsert = makeReturningChain([settingsRow]);

  const db: Record<string, unknown> = {
    query: { tkUserSettings: settingsQuery },
    insert: vi.fn().mockReturnValue(settingsInsert),
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  };

  return { repo: new TkRepository(db as never), db, settingsQuery, settingsInsert, settingsRow };
}

describe('TkRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('findSettings returns the user settings row', async () => {
    const { repo, settingsQuery, settingsRow } = makeRepository();
    await expect(repo.findSettings(7)).resolves.toBe(settingsRow);
    expect(settingsQuery.findFirst).toHaveBeenCalled();
  });

  it('upsertSettings inserts with an onConflictDoUpdate and returns the row', async () => {
    const { repo, db, settingsInsert, settingsRow } = makeRepository();
    const result = await repo.upsertSettings(7, { enabled: false });
    expect(db.insert).toHaveBeenCalled();
    expect(settingsInsert.onConflictDoUpdate).toHaveBeenCalled();
    expect(result).toBe(settingsRow);
  });

  it('userHasTkSyncPermission returns true for a superuser', async () => {
    const { repo, db } = makeRepository();
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeSelectChain([{ isSuperuser: true, permissionName: null }]));
    await expect(repo.userHasTkSyncPermission(7)).resolves.toBe(true);
  });

  it('userHasTkSyncPermission returns true for a user with the permission', async () => {
    const { repo, db } = makeRepository();
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeSelectChain([{ isSuperuser: false, permissionName: Permission.TkSync }]));
    await expect(repo.userHasTkSyncPermission(7)).resolves.toBe(true);
  });

  it('userHasTkSyncPermission returns false without a matching permission row', async () => {
    const { repo, db } = makeRepository();
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeSelectChain([]));
    await expect(repo.userHasTkSyncPermission(7)).resolves.toBe(false);
  });

  it('findSyncedSourceKeys returns an empty set without querying for an empty input', async () => {
    const { repo, db } = makeRepository();
    const result = await repo.findSyncedSourceKeys(7, 'annotation', []);
    expect(result.size).toBe(0);
    expect(db.select).not.toHaveBeenCalled();
  });

  it('findSyncedSourceKeys returns the already-ledgered keys', async () => {
    const { repo, db } = makeRepository();
    const whereMock = vi.fn().mockResolvedValue([{ sourceKey: '1' }, { sourceKey: '2' }]);
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereMock }) });
    const result = await repo.findSyncedSourceKeys(7, 'annotation', ['1', '2', '3']);
    expect(result).toEqual(new Set(['1', '2']));
  });

  it('findPendingAnnotations formats the joined author list into a comma-separated string', async () => {
    const { repo, db } = makeRepository();
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([
        {
          annotationId: 1,
          bookId: 7,
          text: 'Fear is the mind-killer.',
          note: null,
          createdAt: new Date(),
          bookTitle: 'Dune',
          authorsCsv: 'Frank Herbert||',
        },
      ]),
    );
    const rows = await repo.findPendingAnnotations(7, 0, 100);
    expect(rows).toHaveLength(1);
    expect(rows[0].bookAuthor).toBe('Frank Herbert');
  });

  it('findPendingAnnotations returns an empty author string when there are no authors', async () => {
    const { repo, db } = makeRepository();
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue(
      makeSelectChain([{ annotationId: 1, bookId: 7, text: 'text', note: null, createdAt: new Date(), bookTitle: 'Dune', authorsCsv: '' }]),
    );
    const rows = await repo.findPendingAnnotations(7, 0, 100);
    expect(rows[0].bookAuthor).toBe('');
  });

  it('recordSyncedDay inserts ledger rows and advances watermarks inside one transaction', async () => {
    const { repo, db } = makeRepository();
    const insertChain = makeReturningChain([{ id: 1 }]);
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const tx = {
      insert: vi.fn().mockReturnValue(insertChain),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: updateWhere }) }),
    };
    function runTransaction(fn: (tx: unknown) => unknown) {
      return Promise.resolve(fn(tx));
    }
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- mocked `transaction` signature loses the real async contract
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(runTransaction);

    const result = await repo.recordSyncedDay(7, [{ kind: 'annotation', sourceKey: '1', dateKey: '2026-11-17', tkDocumentId: 'doc-1' }], {
      lastAnnotationId: 1,
      lastSyncedAt: new Date(),
    });

    expect(tx.insert).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1 }]);
  });

  it('recordSyncedDay skips the insert when there are no items but still advances watermarks', async () => {
    const { repo, db } = makeRepository();
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const tx = { insert: vi.fn(), update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: updateWhere }) }) };
    function runTransaction(fn: (tx: unknown) => unknown) {
      return Promise.resolve(fn(tx));
    }
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- mocked `transaction` signature loses the real async contract
    (db.transaction as ReturnType<typeof vi.fn>).mockImplementation(runTransaction);

    const result = await repo.recordSyncedDay(7, [], { lastFinishedAt: new Date() });

    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
