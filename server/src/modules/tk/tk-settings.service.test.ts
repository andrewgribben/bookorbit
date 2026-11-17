import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TkSettingsService } from './tk-settings.service';

function makeRepo(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    findSettings: vi.fn().mockResolvedValue({
      enabled: true,
      accessTokenEnc: 'enc-a',
      refreshTokenEnc: 'enc-r',
      disabledReason: null,
      lastSyncedAt: null,
      connectedAt: null,
      backfillRequestedAt: null,
      syncAnnotations: true,
      syncJournal: true,
      syncFinished: true,
    }),
    userHasTkSyncPermission: vi.fn().mockResolvedValue(true),
    upsertSettings: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as import('./tk.repository').TkRepository;
}

function makeScheduler() {
  return { requestSync: vi.fn() } as unknown as import('./tk-auto-sync-scheduler.service').TkAutoSyncSchedulerService;
}

describe('TkSettingsService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('getSettings defaults the three sync-kind flags to true when there is no settings row', async () => {
    const repo = makeRepo({ findSettings: vi.fn().mockResolvedValue(undefined) });
    const service = new TkSettingsService(repo, makeScheduler());

    const settings = await service.getSettings(1);

    expect(settings.syncAnnotations).toBe(true);
    expect(settings.syncJournal).toBe(true);
    expect(settings.syncFinished).toBe(true);
  });

  it('getSettings reflects the stored per-kind flags', async () => {
    const repo = makeRepo({
      findSettings: vi.fn().mockResolvedValue({
        enabled: true,
        accessTokenEnc: 'enc-a',
        refreshTokenEnc: 'enc-r',
        disabledReason: null,
        lastSyncedAt: null,
        connectedAt: null,
        backfillRequestedAt: null,
        syncAnnotations: false,
        syncJournal: true,
        syncFinished: false,
      }),
    });
    const service = new TkSettingsService(repo, makeScheduler());

    const settings = await service.getSettings(1);

    expect(settings).toMatchObject({ syncAnnotations: false, syncJournal: true, syncFinished: false });
  });

  it('upsertSettings saves a single toggled kind without touching the others', async () => {
    const repo = makeRepo();
    const service = new TkSettingsService(repo, makeScheduler());

    await service.upsertSettings(1, { syncJournal: false });

    expect(repo.upsertSettings).toHaveBeenCalledWith(1, { syncJournal: false });
  });

  it('upsertSettings accepts all three kind flags together', async () => {
    const repo = makeRepo();
    const service = new TkSettingsService(repo, makeScheduler());

    await service.upsertSettings(1, { syncAnnotations: false, syncJournal: false, syncFinished: true });

    expect(repo.upsertSettings).toHaveBeenCalledWith(1, { syncAnnotations: false, syncJournal: false, syncFinished: true });
  });

  it('upsertSettings does nothing when the payload is empty', async () => {
    const repo = makeRepo();
    const service = new TkSettingsService(repo, makeScheduler());

    await service.upsertSettings(1, {});

    expect(repo.upsertSettings).not.toHaveBeenCalled();
  });
});
