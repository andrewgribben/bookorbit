import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TkBackfillService } from './tk-backfill.service';

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findSettings: vi.fn().mockResolvedValue({ connectedAt: new Date('2026-01-01T00:00:00Z'), backfillRequestedAt: null }),
    upsertSettings: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as import('./tk.repository').TkRepository;
}

function makeSyncService(preview: unknown) {
  return { previewBackfill: vi.fn().mockResolvedValue(preview) } as unknown as import('./tk-sync.service').TkSyncService;
}

function makeScheduler() {
  return { requestSync: vi.fn() } as unknown as import('./tk-auto-sync-scheduler.service').TkAutoSyncSchedulerService;
}

describe('TkBackfillService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('preview delegates to the sync service and returns its counts unchanged', async () => {
    const preview = { itemCount: 42, dayCount: 7, oldestDateKey: '2020-01-01' };
    const service = new TkBackfillService(makeRepo(), makeSyncService(preview), makeScheduler());
    await expect(service.preview(1)).resolves.toEqual(preview);
  });

  it('refuses to start a backfill before the user has connected TK', async () => {
    const repo = makeRepo({ findSettings: vi.fn().mockResolvedValue({ connectedAt: null, backfillRequestedAt: null }) });
    const service = new TkBackfillService(repo, makeSyncService({}), makeScheduler());
    await expect(service.requestBackfill(1)).rejects.toThrow(/Connect TK/);
  });

  it('requestBackfill sets backfillRequestedAt once and wakes the scheduler', async () => {
    const repo = makeRepo();
    const scheduler = makeScheduler();
    const service = new TkBackfillService(repo, makeSyncService({}), scheduler);

    await service.requestBackfill(1);

    expect(repo.upsertSettings).toHaveBeenCalledWith(1, { backfillRequestedAt: expect.any(Date) });
    expect(scheduler.requestSync).toHaveBeenCalledWith(1);
  });

  it('requestBackfill is idempotent: a second call does not reset backfillRequestedAt', async () => {
    const repo = makeRepo({
      findSettings: vi.fn().mockResolvedValue({ connectedAt: new Date(), backfillRequestedAt: new Date('2026-02-01T00:00:00Z') }),
    });
    const scheduler = makeScheduler();
    const service = new TkBackfillService(repo, makeSyncService({}), scheduler);

    await service.requestBackfill(1);

    expect(repo.upsertSettings).not.toHaveBeenCalled();
    expect(scheduler.requestSync).toHaveBeenCalledWith(1);
  });
});
