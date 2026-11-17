import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import { TK_AUTO_SYNC_DEBOUNCE_MS, TK_AUTO_SYNC_MAX_RETRIES, TK_AUTO_SYNC_MAX_WAIT_MS, TK_AUTO_SYNC_RETRY_BASE_MS } from './tk.constants';
import { TkSyncService } from './tk-sync.service';

interface AutoSyncState {
  userId: number;
  timer: NodeJS.Timeout | null;
  inFlight: boolean;
  pending: boolean;
  retryAttempt: number;
  firstPendingAtMs: number | null;
}

const SCHEDULER_EVENT = 'tk.scheduler';

/** Debounced per-user auto-sync scheduler, mirroring ReadwiseAutoSyncSchedulerService. */
@Injectable()
export class TkAutoSyncSchedulerService {
  private readonly logger = new Logger(TkAutoSyncSchedulerService.name);
  private readonly states = new Map<number, AutoSyncState>();
  private readonly userSyncQueues = new Map<number, Promise<void>>();

  constructor(private readonly syncService: TkSyncService) {}

  requestSync(userId: number): void {
    const state = this.states.get(userId) ?? {
      userId,
      timer: null,
      inFlight: false,
      pending: false,
      retryAttempt: 0,
      firstPendingAtMs: null,
    };
    this.states.set(userId, state);
    if (!state.pending) state.firstPendingAtMs = Date.now();
    state.pending = true;
    state.retryAttempt = 0;
    if (state.inFlight) return;
    this.schedule(state);
  }

  private schedule(state: AutoSyncState, delayMs = TK_AUTO_SYNC_DEBOUNCE_MS, capByMaxWait = true): void {
    if (state.timer) clearTimeout(state.timer);
    const cappedDelayMs = capByMaxWait ? Math.min(delayMs, this.remainingMaxWaitMs(state)) : delayMs;
    state.timer = setTimeout(() => {
      state.timer = null;
      void this.runDue(state.userId);
    }, cappedDelayMs);
  }

  private async runDue(userId: number): Promise<void> {
    const state = this.states.get(userId);
    if (!state || state.inFlight || !state.pending) return;
    state.pending = false;
    state.firstPendingAtMs = null;
    state.inFlight = true;
    let nextDelayMs = TK_AUTO_SYNC_DEBOUNCE_MS;
    const startedAtMs = Date.now();
    try {
      await this.enqueue(userId, () => this.syncService.flush(userId));
      state.retryAttempt = 0;
    } catch (err) {
      const durationMs = Date.now() - startedAtMs;
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      if (state.retryAttempt < TK_AUTO_SYNC_MAX_RETRIES) {
        state.retryAttempt += 1;
        state.pending = true;
        state.firstPendingAtMs ??= Date.now();
        nextDelayMs = TK_AUTO_SYNC_RETRY_BASE_MS * Math.pow(2, state.retryAttempt - 1);
        this.logger.warn(
          `[${SCHEDULER_EVENT}] [fail] userId=${userId} durationMs=${durationMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" retryAttempt=${state.retryAttempt} nextDelayMs=${nextDelayMs} - TK flush failed; retry scheduled`,
        );
      } else {
        state.retryAttempt = 0;
        this.logger.error(
          `[${SCHEDULER_EVENT}] [fail] userId=${userId} durationMs=${durationMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" retryExhausted=true - TK flush failed; retries exhausted`,
        );
      }
    } finally {
      state.inFlight = false;
      if (state.pending) this.schedule(state, nextDelayMs, nextDelayMs === TK_AUTO_SYNC_DEBOUNCE_MS);
      else this.states.delete(userId);
    }
  }

  private remainingMaxWaitMs(state: AutoSyncState): number {
    if (state.firstPendingAtMs === null) return TK_AUTO_SYNC_DEBOUNCE_MS;
    const elapsedMs = Date.now() - state.firstPendingAtMs;
    return Math.max(0, TK_AUTO_SYNC_MAX_WAIT_MS - elapsedMs);
  }

  private enqueue(userId: number, task: () => Promise<void>): Promise<void> {
    const previous = this.userSyncQueues.get(userId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.userSyncQueues.set(userId, current);
    current
      .finally(() => {
        if (this.userSyncQueues.get(userId) === current) this.userSyncQueues.delete(userId);
      })
      .catch(() => undefined);
    return current;
  }
}
