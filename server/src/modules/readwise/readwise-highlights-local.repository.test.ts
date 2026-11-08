import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadwiseHighlightsLocalRepository } from './readwise-highlights-local.repository';

function makeDb(returningRows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(returningRows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { update, set, where, returning, db: { update } };
}

describe('ReadwiseHighlightsLocalRepository', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applyRemoteEdit updates text/note and bumps version, returning true when a row changed', async () => {
    const { db, set } = makeDb([{ id: 5 }]);
    const repo = new ReadwiseHighlightsLocalRepository(db as never);

    await expect(repo.applyRemoteEdit(1, 5, { text: 'new text', note: 'new note' })).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'new text', note: 'new note', version: expect.anything(), updatedAt: expect.anything() }),
    );
  });

  it('applyRemoteEdit returns false when no row matched (already deleted, or not this user)', async () => {
    const { db } = makeDb([]);
    const repo = new ReadwiseHighlightsLocalRepository(db as never);
    await expect(repo.applyRemoteEdit(1, 5, { text: 'x', note: null })).resolves.toBe(false);
  });

  it('applyRemoteDelete soft-deletes and returns true when a row changed', async () => {
    const { db, set } = makeDb([{ id: 5 }]);
    const repo = new ReadwiseHighlightsLocalRepository(db as never);

    await expect(repo.applyRemoteDelete(1, 5)).resolves.toBe(true);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.anything() }));
  });

  it('applyRemoteDelete is idempotent: returns false if already deleted', async () => {
    const { db } = makeDb([]);
    const repo = new ReadwiseHighlightsLocalRepository(db as never);
    await expect(repo.applyRemoteDelete(1, 5)).resolves.toBe(false);
  });
});
