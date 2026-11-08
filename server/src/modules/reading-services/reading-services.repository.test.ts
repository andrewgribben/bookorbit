import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReadingServicesRepository } from './reading-services.repository';

describe('ReadingServicesRepository - item ledger', () => {
  let insertValues: ReturnType<typeof vi.fn>;
  let onConflictDoNothing: ReturnType<typeof vi.fn>;
  let updateWhere: ReturnType<typeof vi.fn>;
  let updateSet: ReturnType<typeof vi.fn>;
  let findFirst: ReturnType<typeof vi.fn>;
  let findMany: ReturnType<typeof vi.fn>;
  let repo: ReadingServicesRepository;

  beforeEach(() => {
    onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
    insertValues = vi.fn().mockReturnValue({ onConflictDoNothing });
    updateWhere = vi.fn().mockResolvedValue(undefined);
    updateSet = vi.fn().mockReturnValue({ where: updateWhere });
    findFirst = vi.fn();
    findMany = vi.fn();

    const db = {
      insert: vi.fn().mockReturnValue({ values: insertValues }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
      query: { readingServiceItemLinks: { findFirst, findMany } },
    };
    repo = new ReadingServicesRepository(db as never);
  });

  it('inserts every ledger row in one statement (atomic batch write)', async () => {
    const items = [
      { userId: 1, provider: 'readwise' as const, kind: 'session', localId: 10, externalId: 'ext-10' },
      { userId: 1, provider: 'readwise' as const, kind: 'session', localId: 11, externalId: 'ext-11' },
    ];

    await repo.recordItemLinks(items);

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(items);
    expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an empty batch', async () => {
    await repo.recordItemLinks([]);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('finds a ledger row by external id, scoped to user/provider/kind', async () => {
    findFirst.mockResolvedValueOnce({ localId: 10 });
    const result = await repo.findItemLinkByExternalId(1, 'readwise', 'session', 'ext-10');
    expect(result).toEqual({ localId: 10 });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('marks a ledger row deleted', async () => {
    await repo.markItemLinkDeleted(1, 'readwise', 'session', 10);
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ deletedAt: expect.any(Date) }));
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });

  it('updates a ledger row content hash and sync timestamp', async () => {
    await repo.updateItemLinkContentHash(1, 'readwise', 'highlight', 10, 'new-hash');
    expect(updateSet).toHaveBeenCalledWith({ contentHash: 'new-hash', syncedAt: expect.any(Date) });
    expect(updateWhere).toHaveBeenCalledTimes(1);
  });
});
