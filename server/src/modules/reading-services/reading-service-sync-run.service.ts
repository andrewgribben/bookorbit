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

/**
 * True while a migration run's cursor is in its "index" sub-phase (building/matching against
 * the full remote library before any create/update happens) - the reconnect-safe matching pass
 * described in docs/AGENT_HANDOFF.md. Cursor shape is provider-specific; this only looks for the
 * `phase: 'index'` convention Readwise's books migration uses.
 */
function isIndexingCursor(cursor: unknown): boolean {
  return !!cursor && typeof cursor === 'object' && (cursor as Record<string, unknown>)['phase'] === 'index';
}

function toProgress(run: ReadingServiceRun, reconciling: boolean): SyncRunProgress {
  const phase: SyncRunProgress['phase'] = run.status === 'running' && (isIndexingCursor(run.cursor) || reconciling) ? 'reconciling' : null;
  return {
    id: run.id,
    provider: run.provider as ReadingServiceProvider,
    kind: run.kind as SyncRunProgress['kind'],
    status: run.status as SyncRunProgress['status'],
    counters: run.counters as SyncRunProgressCounters,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    error: run.error ?? null,
    phase,
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
  /**
   * Set of `${userId}:${provider}` keys currently inside a provider-reported reconcile pass
   * that isn't visible on a migration run's own cursor (Readwise's sessions reconcile, which
   * runs during a push flush, not a migration run). In-memory only, same lifetime/scope as
   * `cancelled` above: a transient status signal for the UI, not a durable record.
   */
  private readonly reconciling = new Set<string>();

  constructor(
    private readonly repo: ReadingServicesRepository,
    private readonly registry: ReadingServiceRegistry,
  ) {}

  /** Call from a provider's own reconcile pass (e.g. Readwise's first-connect sessions reconcile). */
  markReconciling(userId: number, provider: ReadingServiceProvider): void {
    this.reconciling.add(`${userId}:${provider}`);
  }

  /** Must be called once the reconcile pass finishes, success or failure. */
  clearReconciling(userId: number, provider: ReadingServiceProvider): void {
    this.reconciling.delete(`${userId}:${provider}`);
  }

  private isReconciling(userId: number, provider: ReadingServiceProvider): boolean {
    return this.reconciling.has(`${userId}:${provider}`);
  }

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
    if (existing) return toProgress(existing, this.isReconciling(userId, provider));

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
        if (racedRun) return toProgress(racedRun, this.isReconciling(userId, provider));
      }
      throw err;
    }

    void this.runLoop(run).catch((err) => this.logFailure(run, err, Date.now()));
    return toProgress(run, this.isReconciling(userId, provider));
  }

  async getRun(id: number, userId: number): Promise<SyncRunProgress> {
    const run = await this.repo.findRun(id, userId);
    if (!run) throw new NotFoundException(`Reading-service run ${id} not found`);
    return toProgress(run, this.isReconciling(userId, run.provider as ReadingServiceProvider));
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
    return toProgress(resumed, this.isReconciling(userId, resumed.provider as ReadingServiceProvider));
  }

  async getLatestMigrationSummary(userId: number, provider: ReadingServiceProvider): Promise<ReadingServiceSummary['migration']> {
    const run = await this.repo.findLatestRun(userId, provider, 'migration');
    if (!run) return { state: 'never', runId: null, finishedAt: null };
    const state = run.status === 'running' ? 'running' : run.status === 'completed' ? 'done' : run.status === 'failed' ? 'failed' : 'never';
    const reconciling = state === 'running' && (isIndexingCursor(run.cursor) || this.isReconciling(userId, provider));
    return { state, runId: run.id, finishedAt: run.finishedAt?.toISOString() ?? null, phase: reconciling ? 'reconciling' : null };
  }

  async cancel(id: number, userId: number): Promise<SyncRunProgress> {
    const run = await this.repo.findRun(id, userId);
    if (!run) throw new NotFoundException(`Reading-service run ${id} not found`);

    this.cancelled.add(id);
    if (run.status === 'running') {
      const finishedAt = new Date();
      await this.repo.updateRun(id, { status: 'cancelled', finishedAt });
      return toProgress({ ...run, status: 'cancelled', finishedAt }, this.isReconciling(userId, run.provider as ReadingServiceProvider));
    }
    return toProgress(run, this.isReconciling(userId, run.provider as ReadingServiceProvider));
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
