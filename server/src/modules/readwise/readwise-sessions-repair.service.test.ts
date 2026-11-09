import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadingServicesRepository } from '../reading-services/reading-services.repository';
import { ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { readwiseSessionContentHash } from './readwise-session-hash.utils';
import { ReadwiseSessionsDeleteUnlinkService } from './readwise-sessions-delete-unlink.service';
import type { LinkedSessionForRepair } from './readwise-sessions-local.repository';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import { ReadwiseSessionsRepairService } from './readwise-sessions-repair.service';

function linkedSession(partial: Partial<LinkedSessionForRepair> & { id: number; externalId: string }): LinkedSessionForRepair {
  return {
    bookId: 10,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    endedAt: new Date('2026-01-01T00:10:00Z'),
    durationSeconds: 600,
    contentHash: null,
    syncedAt: new Date('2026-01-01T00:11:00Z'),
    ...partial,
  };
}

function makeService() {
  const sessionsRepo = {
    findLinkedSessionsForBook: vi.fn().mockResolvedValue([]),
  } as unknown as ReadwiseSessionsLocalRepository;
  const readingServicesRepo = {
    updateItemLinkContentHash: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReadingServicesRepository;
  const deleteUnlink = {
    deleteAndUnlink: vi.fn().mockResolvedValue({ deleted: 0, unlinkedBookIds: [], failed: 0 }),
  } as unknown as ReadwiseSessionsDeleteUnlinkService;

  const service = new ReadwiseSessionsRepairService(sessionsRepo, readingServicesRepo, deleteUnlink);
  return { service, sessionsRepo, readingServicesRepo, deleteUnlink };
}

describe('ReadwiseSessionsRepairService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes and unlinks a session whose content hash no longer matches', async () => {
    const { service, sessionsRepo, deleteUnlink } = makeService();
    const row = linkedSession({ id: 1, externalId: 'ext-1', contentHash: 'stale-hash' });
    (sessionsRepo.findLinkedSessionsForBook as any).mockResolvedValueOnce([row]);
    (deleteUnlink.deleteAndUnlink as any).mockResolvedValueOnce({ deleted: 1, unlinkedBookIds: [10], failed: 0 });

    const changed = await service.repairBook(1, 'tok', 10);

    expect(deleteUnlink.deleteAndUnlink).toHaveBeenCalledWith(1, 'tok', expect.any(String), [{ localId: 1, bookId: 10, externalId: 'ext-1' }]);
    expect(changed).toBe(1);
  });

  it('leaves a session alone whose content hash still matches', async () => {
    const { service, sessionsRepo, deleteUnlink } = makeService();
    const row = linkedSession({ id: 1, externalId: 'ext-1' });
    row.contentHash = readwiseSessionContentHash(row);
    (sessionsRepo.findLinkedSessionsForBook as any).mockResolvedValueOnce([row]);

    const changed = await service.repairBook(1, 'tok', 10);

    expect(deleteUnlink.deleteAndUnlink).not.toHaveBeenCalled();
    expect(changed).toBe(0);
  });

  it('treats a null content hash whose session kept moving after sync as changed', async () => {
    const { service, sessionsRepo, deleteUnlink } = makeService();
    const row = linkedSession({
      id: 1,
      externalId: 'ext-1',
      contentHash: null,
      endedAt: new Date('2026-01-01T01:00:00Z'),
      syncedAt: new Date('2026-01-01T00:10:00Z'),
    });
    (sessionsRepo.findLinkedSessionsForBook as any).mockResolvedValueOnce([row]);
    (deleteUnlink.deleteAndUnlink as any).mockResolvedValueOnce({ deleted: 1, unlinkedBookIds: [10], failed: 0 });

    const changed = await service.repairBook(1, 'tok', 10);

    expect(deleteUnlink.deleteAndUnlink).toHaveBeenCalledWith(1, 'tok', expect.any(String), [{ localId: 1, bookId: 10, externalId: 'ext-1' }]);
    expect(changed).toBe(1);
  });

  it('backfills the content hash for a null-hash session that did not move after sync', async () => {
    const { service, sessionsRepo, readingServicesRepo, deleteUnlink } = makeService();
    const row = linkedSession({
      id: 1,
      externalId: 'ext-1',
      contentHash: null,
      endedAt: new Date('2026-01-01T00:10:00Z'),
      syncedAt: new Date('2026-01-01T00:11:00Z'),
    });
    (sessionsRepo.findLinkedSessionsForBook as any).mockResolvedValueOnce([row]);

    await service.repairBook(1, 'tok', 10);

    expect(deleteUnlink.deleteAndUnlink).not.toHaveBeenCalled();
    expect(readingServicesRepo.updateItemLinkContentHash).toHaveBeenCalledWith(1, 'readwise', 'session', 1, readwiseSessionContentHash(row));
  });

  it('is keyset-paged and bounded per call', async () => {
    const { service, sessionsRepo } = makeService();
    const fullPage = Array.from({ length: 200 }, (_, i) => linkedSession({ id: i + 1, externalId: `ext-${i + 1}` }));
    (sessionsRepo.findLinkedSessionsForBook as any).mockResolvedValue(fullPage);

    await service.repairBook(1, 'tok', 10);

    // Bounded to READWISE_SESSIONS_REPAIR_MAX_PAGES_PER_CALL pages per call.
    expect((sessionsRepo.findLinkedSessionsForBook as any).mock.calls.length).toBe(3);
    expect((sessionsRepo.findLinkedSessionsForBook as any).mock.calls[0]).toEqual([1, 10, 0, 200]);
    expect((sessionsRepo.findLinkedSessionsForBook as any).mock.calls[1]).toEqual([1, 10, 200, 200]);
  });

  it('never throws; logs and returns on a non-auth failure', async () => {
    const { service, sessionsRepo } = makeService();
    (sessionsRepo.findLinkedSessionsForBook as any).mockRejectedValueOnce(new Error('db unavailable'));

    const changed = await service.repairBook(1, 'tok', 10);

    expect(changed).toBe(0);
  });

  it('rethrows a forbidden error so the caller can disable the connection', async () => {
    const { service, sessionsRepo } = makeService();
    (sessionsRepo.findLinkedSessionsForBook as any).mockRejectedValueOnce(new ReadwiseBooksForbiddenError());

    await expect(service.repairBook(1, 'tok', 10)).rejects.toBeInstanceOf(ReadwiseBooksForbiddenError);
  });
});
