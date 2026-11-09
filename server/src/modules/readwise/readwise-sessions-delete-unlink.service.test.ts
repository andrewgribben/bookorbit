import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ReadwiseBooksClientService, ReadwiseBooksForbiddenError } from './readwise-books-client.service';
import { ReadwiseUnauthorizedError } from './readwise-client.service';
import { ReadwiseSessionsDeleteUnlinkService } from './readwise-sessions-delete-unlink.service';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';

function makeService() {
  const client = { deleteSessions: vi.fn() } as unknown as ReadwiseBooksClientService;
  const sessionsRepo = { unlinkSessions: vi.fn().mockResolvedValue(undefined) } as unknown as ReadwiseSessionsLocalRepository;
  const service = new ReadwiseSessionsDeleteUnlinkService(client, sessionsRepo);
  return { service, client, sessionsRepo };
}

describe('ReadwiseSessionsDeleteUnlinkService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing for an empty batch', async () => {
    const { service, client } = makeService();
    const result = await service.deleteAndUnlink(1, 'tok', 'test.event', []);
    expect(client.deleteSessions).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: 0, unlinkedBookIds: [], failed: 0 });
  });

  it('deletes on Readwise before unlinking locally', async () => {
    const { service, client, sessionsRepo } = makeService();
    const callOrder: string[] = [];
    (client.deleteSessions as any).mockImplementation(() => {
      callOrder.push('delete');
      return Promise.resolve([{ id: 'ext-1', status: 'deleted', error: null }]);
    });
    (sessionsRepo.unlinkSessions as any).mockImplementation(() => {
      callOrder.push('unlink');
      return Promise.resolve();
    });

    const result = await service.deleteAndUnlink(1, 'tok', 'test.event', [{ localId: 1, bookId: 10, externalId: 'ext-1' }]);

    expect(client.deleteSessions).toHaveBeenCalledWith(1, 'tok', ['ext-1']);
    expect(sessionsRepo.unlinkSessions).toHaveBeenCalledWith(1, [1]);
    expect(callOrder).toEqual(['delete', 'unlink']);
    expect(result).toEqual({ deleted: 1, unlinkedBookIds: [10], failed: 0 });
  });

  it('treats a not_found result as already gone and unlinks it', async () => {
    const { service, client, sessionsRepo } = makeService();
    (client.deleteSessions as any).mockResolvedValueOnce([{ id: 'ext-1', status: 'error', error: { code: 'not_found' } }]);

    const result = await service.deleteAndUnlink(1, 'tok', 'test.event', [{ localId: 1, bookId: 10, externalId: 'ext-1' }]);

    expect(sessionsRepo.unlinkSessions).toHaveBeenCalledWith(1, [1]);
    expect(result.deleted).toBe(1);
  });

  it('keeps the link when a delete errors for another reason', async () => {
    const { service, client, sessionsRepo } = makeService();
    (client.deleteSessions as any).mockResolvedValueOnce([{ id: 'ext-1', status: 'error', error: { code: 'invalid_value' } }]);

    const result = await service.deleteAndUnlink(1, 'tok', 'test.event', [{ localId: 1, bookId: 10, externalId: 'ext-1' }]);

    expect(sessionsRepo.unlinkSessions).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: 0, unlinkedBookIds: [], failed: 1 });
  });

  it('never unlinks when the whole batch outcome is unknown (network error, 5xx, bad shape)', async () => {
    const { service, client, sessionsRepo } = makeService();
    (client.deleteSessions as any).mockRejectedValueOnce(new Error('network timeout'));

    const result = await service.deleteAndUnlink(1, 'tok', 'test.event', [{ localId: 1, bookId: 10, externalId: 'ext-1' }]);

    expect(sessionsRepo.unlinkSessions).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: 0, unlinkedBookIds: [], failed: 1 });
  });

  it('rethrows a forbidden error without unlinking', async () => {
    const { service, client, sessionsRepo } = makeService();
    (client.deleteSessions as any).mockRejectedValueOnce(new ReadwiseBooksForbiddenError());

    await expect(service.deleteAndUnlink(1, 'tok', 'test.event', [{ localId: 1, bookId: 10, externalId: 'ext-1' }])).rejects.toBeInstanceOf(
      ReadwiseBooksForbiddenError,
    );
    expect(sessionsRepo.unlinkSessions).not.toHaveBeenCalled();
  });

  it('rethrows an unauthorized error without unlinking', async () => {
    const { service, client, sessionsRepo } = makeService();
    (client.deleteSessions as any).mockRejectedValueOnce(new ReadwiseUnauthorizedError());

    await expect(service.deleteAndUnlink(1, 'tok', 'test.event', [{ localId: 1, bookId: 10, externalId: 'ext-1' }])).rejects.toBeInstanceOf(
      ReadwiseUnauthorizedError,
    );
    expect(sessionsRepo.unlinkSessions).not.toHaveBeenCalled();
  });
});
