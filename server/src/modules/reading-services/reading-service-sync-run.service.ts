import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';

import type { ReadingServiceProvider, ReadingServiceSummary, SyncRunProgress, SyncRunProgressCounters } from '@bookorbit/types';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import type { ReadingServiceRun } from '../../db/schema';
import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServicesRepository } from './reading-services.repository';

const EVENT = 'reading_services.migration';

function emptyCounters(): SyncRunProgressCounters {
  return { scanned: 0, matched: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
}

function toProgress(run: ReadingServiceRun): SyncRunProgress {
  return {
    id: run.id,
    provider: run.provider as ReadingServiceProvider,
    kind: run.kind as SyncRunProgress['kind'],
    status: run.status as SyncRunProgress['status'],
    counters: run.counters as SyncRunProgressCounters,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    error: run.error ?? null,
  };
}

function isUniqueRunningRunViolation(err: unknown): boolean {
  let current: unknown = err;
  const seen = new Set<unknown>();
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    const entry = current as Record<string, unknown>;
    if (entry['code'] === '23505') {
      const constraint = typeof entry['constraint'] === 'string' ? entry['constraint'] : '';
      const message = entry instanceof Error ? entry.message : '';
      if (constraint.includes('rs_runs_user_provider_kind_running') || message.includes('rs_runs_user_provider_kind_running')) {
        return true;
      }
    }
    current = (entry as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Runs one provider migration page at a time, persisting progress after every page so a run
 * resumes from its cursor after a restart rather than starting over.
 */
@Injectable()
export class ReadingServiceSyncRunService implements OnModuleInit {
  private readonly logger = new Logger(ReadingServiceSyncRunService.name);
  private readonly cancelled = new Set<number>();

  constructor(
    private readonly repo: ReadingServicesRepository,
    private readonly registry: ReadingServiceRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    const runs = await this.repo.findRunningRuns();
    for (const run of runs) {
      void this.runLoop(run).catch((err) => this.logFailure(run, err, Date.now()));
    }
  }

  async startMigration(userId: number, provider: ReadingServiceProvider): Promise<SyncRunProgress> {
    if (!this.registry.has(provider)) {
      throw new BadRequestException(`Unknown reading-service provider: ${provider}`);
    }

    const existing = await this.repo.findRunningRun(userId, provider, 'migration');
    if (existing) return toProgress(existing);

    let run: ReadingServiceRun;
    try {
      run = await this.repo.createRun(userId, provider, 'migration', emptyCounters());
    } catch (err) {
      // Two concurrent requests can both pass the findRunningRun check above before either
      // insert commits. The partial unique index on (userId, provider, kind) WHERE status =
      // 'running' catches the loser here; fetch and return the run the race actually created
      // instead of starting a second, duplicate one.
      if (isUniqueRunningRunViolation(err)) {
        const racedRun = await this.repo.findRunningRun(userId, provider, 'migration');
        if (racedRun) return toProgress(racedRun);
      }
      throw err;
    }

    void this.runLoop(run).catch((err) => this.logFailure(run, err, Date.now()));
    return toProgress(run);
  }

  async getRun(id: number, userId: number): Promise<SyncRunProgress> {
    const run = await this.repo.findRun(id, userId);
    if (!run) throw new NotFoundException(`Reading-service run ${id} not found`);
    return toProgress(run);
  }

  /**
   * Restarts a failed run from its stored cursor and counters rather than starting a fresh run
   * with an empty cursor, so progress already made against the remote provider isn't redone.
   */
  async resumeMigration(id: number, userId: number): Promise<SyncRunProgress> {
    const run = await this.repo.findRun(id, userId);
    if (!run) throw new NotFoundException(`Reading-service run ${id} not found`);
    if (run.status !== 'failed') {
      throw new BadRequestException(`Reading-service run ${id} is not in a failed state`);
    }

    await this.repo.updateRun(id, { status: 'running', error: null, finishedAt: null });
    const resumed: ReadingServiceRun = { ...run, status: 'running', error: null, finishedAt: null };
    this.logger.log(`[${EVENT}] [start] userId=${resumed.userId} provider=${resumed.provider} runId=${resumed.id} - migration resumed from cursor`);
    void this.runLoop(resumed).catch((err) => this.logFailure(resumed, err, Date.now()));
    return toProgress(resumed);
  }

  async getLatestMigrationSummary(userId: number, provider: ReadingServiceProvider): Promise<ReadingServiceSummary['migration']> {
    const run = await this.repo.findLatestRun(userId, provider, 'migration');
    if (!run) return { state: 'never', runId: null, finishedAt: null };
    const state = run.status === 'running' ? 'running' : run.status === 'completed' ? 'done' : run.status === 'failed' ? 'failed' : 'never';
    return { state, runId: run.id, finishedAt: run.finishedAt?.toISOString() ?? null };
  }

  async cancel(id: number, userId: number): Promise<SyncRunProgress> {
    const run = await this.repo.findRun(id, userId);
    if (!run) throw new NotFoundException(`Reading-service run ${id} not found`);

    this.cancelled.add(id);
    if (run.status === 'running') {
      const finishedAt = new Date();
      await this.repo.updateRun(id, { status: 'cancelled', finishedAt });
      return toProgress({ ...run, status: 'cancelled', finishedAt });
    }
    return toProgress(run);
  }

  private async runLoop(run: ReadingServiceRun): Promise<void> {
    const adapter = this.registry.get(run.provider as ReadingServiceProvider);
    const startedAtMs = Date.now();
    this.logger.log(`[${EVENT}] [start] userId=${run.userId} provider=${run.provider} runId=${run.id} - migration started`);

    if (!adapter) {
      await this.fail(run, startedAtMs, new Error(`no adapter registered for provider ${run.provider}`));
      return;
    }

    let cursor = run.cursor;
    const counters = run.counters as SyncRunProgressCounters;

    try {
      for (;;) {
        if (this.cancelled.has(run.id)) {
          await this.repo.updateRun(run.id, { status: 'cancelled', finishedAt: new Date(), cursor, counters });
          return;
        }

        const next = await adapter.migratePage(run.userId, cursor, counters);

        // Re-check after the await: cancel() can land while this page's migratePage call was
        // in flight, including on what turns out to be the final page. Without this check the
        // completed write below would silently overwrite the cancellation that already happened.
        if (this.cancelled.has(run.id)) {
          await this.repo.updateRun(run.id, { status: 'cancelled', finishedAt: new Date(), cursor: next ?? cursor, counters });
          return;
        }

        await this.repo.updateRun(run.id, { cursor: next ?? cursor, counters });
        if (next === null) break;
        cursor = next;
      }

      await this.repo.updateRun(run.id, { status: 'completed', finishedAt: new Date(), counters });
      this.logger.log(
        `[${EVENT}] [end] userId=${run.userId} provider=${run.provider} runId=${run.id} durationMs=${Date.now() - startedAtMs} created=${counters.created} updated=${counters.updated} skipped=${counters.skipped} failed=${counters.failed} - migration completed`,
      );
    } catch (err) {
      await this.fail(run, startedAtMs, err, counters);
    } finally {
      this.cancelled.delete(run.id);
    }
  }

  private async fail(run: ReadingServiceRun, startedAtMs: number, err: unknown, counters?: SyncRunProgressCounters): Promise<void> {
    const error = sanitizeLogValue(err instanceof Error ? err.message : String(err));
    await this.repo.updateRun(run.id, { status: 'failed', finishedAt: new Date(), error, ...(counters ? { counters } : {}) });
    this.logFailure(run, err, startedAtMs, error);
  }

  private logFailure(run: ReadingServiceRun, err: unknown, startedAtMs: number, sanitizedError?: string): void {
    const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
    const error = sanitizedError ?? sanitizeLogValue(err instanceof Error ? err.message : String(err));
    this.logger.error(
      `[${EVENT}] [fail] userId=${run.userId} provider=${run.provider} runId=${run.id} durationMs=${Date.now() - startedAtMs} errorClass=${errorClass} error="${error}" - migration failed`,
    );
  }
}
