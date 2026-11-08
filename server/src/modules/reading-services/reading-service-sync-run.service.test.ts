import { BadRequestException, NotFoundException } from '@nestjs/common';

import type { ReadingServiceProviderAdapter } from './reading-service-provider';
import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServiceSyncRunService } from './reading-service-sync-run.service';
import type { ReadingServiceRun } from '../../db/schema';
import type { ReadingServicesRepository } from './reading-services.repository';

function makeRun(overrides: Partial<ReadingServiceRun> = {}): ReadingServiceRun {
  return {
    id: 1,
    userId: 1,
    provider: 'readwise',
    kind: 'migration',
    status: 'running',
    cursor: {},
    counters: { scanned: 0, matched: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
    error: null,
    startedAt: new Date(),
    finishedAt: null,
    ...overrides,
  };
}

function makeFakeAdapter(pages: (Record<string, unknown> | null)[]): ReadingServiceProviderAdapter {
  let call = 0;
  return {
    provider: 'readwise',
    permission: Permission.ReadwiseSync,
    capabilities: {},
    isConnected: () => Promise.resolve(true),
    migratePage: (_userId, _cursor, counters) => {
      counters.scanned += 1;
      const result = pages[call];
      call += 1;
      return Promise.resolve(result ?? null);
    },
    pull: () => Promise.resolve(undefined),
  };
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

function makeRepo(run: ReadingServiceRun) {
  const updates: Partial<ReadingServiceRun>[] = [];
  const repo = {
    createRun: vi.fn().mockResolvedValue(run),
    findRun: vi.fn().mockResolvedValue(run),
    findRunningRun: vi.fn().mockResolvedValue(undefined),
    findRunningRuns: vi.fn().mockResolvedValue([]),
    updateRun: vi.fn().mockImplementation((_id: number, patch: Partial<ReadingServiceRun>) => {
      updates.push(patch);
      Object.assign(run, patch);
      return Promise.resolve();
    }),
  } as unknown as ReadingServicesRepository;
  return { repo, updates };
}

function uniqueViolation(): Error {
  return Object.assign(new Error('duplicate key value violates unique constraint "rs_runs_user_provider_kind_running_uidx"'), {
    code: '23505',
    constraint: 'rs_runs_user_provider_kind_running_uidx',
  });
}

describe('ReadingServiceSyncRunService', () => {
  it('rejects starting a migration for a provider with no registered adapter', async () => {
    const run = makeRun();
    const { repo } = makeRepo(run);
    const registry = new ReadingServiceRegistry();
    const service = new ReadingServiceSyncRunService(repo, registry);

    await expect(service.startMigration(1, 'readwise')).rejects.toThrow(BadRequestException);
  });

  it('runs every page until the adapter returns null, then marks the run completed', async () => {
    const run = makeRun();
    const { repo, updates } = makeRepo(run);
    const registry = new ReadingServiceRegistry();
    registry.register(makeFakeAdapter([{ phase: 'push' }, null]));
    const service = new ReadingServiceSyncRunService(repo, registry);

    const progress = await service.startMigration(1, 'readwise');
    expect(progress.status).toBe('running');

    await flushMicrotasks();

    expect(run.status).toBe('completed');
    expect(run.counters.scanned).toBe(2);
    expect(updates.some((u) => u.status === 'completed')).toBe(true);
  });

  it('resumes a run left running from its stored cursor on module init', async () => {
    const run = makeRun({ cursor: { phase: 'push', afterBookId: 7 } });
    const { repo } = makeRepo(run);
    (repo.findRunningRuns as any).mockResolvedValue([run]);
    const registry = new ReadingServiceRegistry();
    const migratePage = vi.fn().mockResolvedValue(null);
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage,
      pull: () => Promise.resolve(undefined),
    });
    const service = new ReadingServiceSyncRunService(repo, registry);

    await service.onModuleInit();
    await flushMicrotasks();

    expect(migratePage).toHaveBeenCalledWith(1, { phase: 'push', afterBookId: 7 }, run.counters);
    expect(run.status).toBe('completed');
  });

  it('stops before the next page once cancelled', async () => {
    const run = makeRun();
    const { repo } = makeRepo(run);
    const registry = new ReadingServiceRegistry();
    let resolvePage1: (value: Record<string, unknown> | null) => void = () => undefined;
    const migratePage = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolvePage1 = resolve)))
      .mockImplementationOnce(() => Promise.resolve(null));
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage,
      pull: () => Promise.resolve(undefined),
    });
    const service = new ReadingServiceSyncRunService(repo, registry);

    const progress = await service.startMigration(1, 'readwise');
    resolvePage1({ phase: 'push' });
    await service.cancel(progress.id, 1);
    await flushMicrotasks();

    expect(run.status).toBe('cancelled');
    expect(migratePage).toHaveBeenCalledTimes(1);
  });

  it('does not overwrite a cancellation with completed when cancelled during the final in-flight page', async () => {
    const run = makeRun();
    const { repo } = makeRepo(run);
    const registry = new ReadingServiceRegistry();
    let resolveFinalPage: (value: Record<string, unknown> | null) => void = () => undefined;
    const migratePage = vi.fn().mockImplementationOnce(() => new Promise((resolve) => (resolveFinalPage = resolve)));
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage,
      pull: () => Promise.resolve(undefined),
    });
    const service = new ReadingServiceSyncRunService(repo, registry);

    const progress = await service.startMigration(1, 'readwise');
    await service.cancel(progress.id, 1);
    expect(run.status).toBe('cancelled');

    resolveFinalPage(null);
    await flushMicrotasks();

    expect(run.status).toBe('cancelled');
    expect(migratePage).toHaveBeenCalledTimes(1);
  });

  it('returns the existing running run instead of starting a duplicate', async () => {
    const existingRun = makeRun({ id: 5 });
    const { repo } = makeRepo(existingRun);
    (repo.findRunningRun as any).mockResolvedValue(existingRun);
    const registry = new ReadingServiceRegistry();
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: vi.fn(),
      pull: () => Promise.resolve(undefined),
    });
    const service = new ReadingServiceSyncRunService(repo, registry);

    const progress = await service.startMigration(1, 'readwise');

    expect(progress.id).toBe(5);
    expect(repo.createRun).not.toHaveBeenCalled();
  });

  it('recovers from a racing duplicate-insert by returning the run the race created', async () => {
    const run = makeRun();
    const { repo } = makeRepo(run);
    (repo.findRunningRun as any).mockResolvedValueOnce(undefined).mockResolvedValueOnce(run);
    (repo.createRun as any).mockRejectedValueOnce(uniqueViolation());
    const registry = new ReadingServiceRegistry();
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: vi.fn().mockResolvedValue(null),
      pull: () => Promise.resolve(undefined),
    });
    const service = new ReadingServiceSyncRunService(repo, registry);

    const progress = await service.startMigration(1, 'readwise');

    expect(progress.id).toBe(run.id);
  });

  it('marks the run failed and sanitizes the error when the adapter throws', async () => {
    const run = makeRun();
    const { repo } = makeRepo(run);
    const registry = new ReadingServiceRegistry();
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage: () => {
        throw new Error('line one\nline two "quoted"');
      },
      pull: () => Promise.resolve(undefined),
    });
    const service = new ReadingServiceSyncRunService(repo, registry);

    await service.startMigration(1, 'readwise');
    await flushMicrotasks();

    expect(run.status).toBe('failed');
    expect(run.error).not.toContain('\n');
  });

  it('throws NotFoundException for a run that does not belong to the user', async () => {
    const run = makeRun();
    const repo = { findRun: vi.fn().mockResolvedValue(undefined) } as unknown as ReadingServicesRepository;
    const service = new ReadingServiceSyncRunService(repo, new ReadingServiceRegistry());

    await expect(service.getRun(run.id, 999)).rejects.toThrow(NotFoundException);
  });

  it('reports a "never" migration state when no run has ever been started', async () => {
    const repo = { findLatestRun: vi.fn().mockResolvedValue(undefined) } as unknown as ReadingServicesRepository;
    const service = new ReadingServiceSyncRunService(repo, new ReadingServiceRegistry());

    await expect(service.getLatestMigrationSummary(1, 'readwise')).resolves.toEqual({ state: 'never', runId: null, finishedAt: null });
  });

  it('maps the latest run status onto a migration summary state', async () => {
    const finishedAt = new Date();
    const repo = {
      findLatestRun: vi.fn().mockResolvedValue(makeRun({ id: 9, status: 'completed', finishedAt })),
    } as unknown as ReadingServicesRepository;
    const service = new ReadingServiceSyncRunService(repo, new ReadingServiceRegistry());

    await expect(service.getLatestMigrationSummary(1, 'readwise')).resolves.toEqual({
      state: 'done',
      runId: 9,
      finishedAt: finishedAt.toISOString(),
    });
  });

  it('resumes a failed run from its stored cursor instead of starting over', async () => {
    const run = makeRun({ status: 'failed', cursor: { phase: 'push', afterBookId: 42 }, error: 'rate limited' });
    const { repo } = makeRepo(run);
    const registry = new ReadingServiceRegistry();
    const migratePage = vi.fn().mockResolvedValue(null);
    registry.register({
      provider: 'readwise',
      permission: Permission.ReadwiseSync,
      capabilities: {},
      isConnected: () => Promise.resolve(true),
      migratePage,
      pull: () => Promise.resolve(undefined),
    });
    const service = new ReadingServiceSyncRunService(repo, registry);

    const progress = await service.resumeMigration(run.id, run.userId);
    expect(progress.status).toBe('running');
    expect(progress.error).toBeNull();

    await flushMicrotasks();

    expect(migratePage).toHaveBeenCalledWith(run.userId, { phase: 'push', afterBookId: 42 }, run.counters);
    expect(run.status).toBe('completed');
  });

  it('rejects resuming a run that is not in a failed state', async () => {
    const run = makeRun({ status: 'completed' });
    const { repo } = makeRepo(run);
    const service = new ReadingServiceSyncRunService(repo, new ReadingServiceRegistry());

    await expect(service.resumeMigration(run.id, run.userId)).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when resuming a run that does not belong to the user', async () => {
    const repo = { findRun: vi.fn().mockResolvedValue(undefined) } as unknown as ReadingServicesRepository;
    const service = new ReadingServiceSyncRunService(repo, new ReadingServiceRegistry());

    await expect(service.resumeMigration(1, 999)).rejects.toThrow(NotFoundException);
  });
});
