import { Injectable, Logger } from '@nestjs/common';

import { sanitizeLogValue } from '../../common/utils/log-sanitize.utils';
import {
  READWISE_SESSIONS_PUSH_DEBOUNCE_MS,
  READWISE_SESSIONS_PUSH_MAX_RETRIES,
  READWISE_SESSIONS_PUSH_MAX_WAIT_MS,
  READWISE_SESSIONS_PUSH_RETRY_BASE_MS,
} from './readwise.constants';
import { ReadwiseSessionsPushService } from './readwise-sessions-push.service';

interface PushState {
  userId: number;
  pendingBookIds: Set<number>;
  timer: NodeJS.Timeout | null;
  inFlight: boolean;
  retryAttempt: number;
  firstPendingAtMs: number | null;
}

const SCHEDULER_EVENT = 'readwise.sessions_push_scheduler';

/**
 * Debounces `reading-session.saved` into a batched sessions push per user, mirroring
 * `ReadwiseBooksPushSchedulerService`'s shape exactly (per-book id batching, capped-exponential
 * retry on failure).
 */
@Injectable()
export class ReadwiseSessionsPushSchedulerService {
  private readonly logger = new Logger(ReadwiseSessionsPushSchedulerService.name);
  private readonly states = new Map<number, PushState>();
  private readonly userPushQueues = new Map<number, Promise<void>>();

  constructor(private readonly pushService: ReadwiseSessionsPushService) {}

  requestPush(userId: number, bookIds: number[]): void {
    if (bookIds.length === 0) return;
    const state = this.states.get(userId) ?? {
      userId,
      pendingBookIds: new Set<number>(),
      timer: null,
      inFlight: false,
      retryAttempt: 0,
      firstPendingAtMs: null,
    };
    this.states.set(userId, state);
    if (state.pendingBookIds.size === 0) state.firstPendingAtMs = Date.now();
    for (const bookId of bookIds) state.pendingBookIds.add(bookId);
    state.retryAttempt = 0;
    if (state.inFlight) return;
    this.schedule(state);
  }

  private schedule(state: PushState, delayMs = READWISE_SESSIONS_PUSH_DEBOUNCE_MS, capByMaxWait = true): void {
    if (state.timer) clearTimeout(state.timer);
    const cappedDelayMs = capByMaxWait ? Math.min(delayMs, this.remainingMaxWaitMs(state)) : delayMs;
    state.timer = setTimeout(() => {
      state.timer = null;
      void this.runDue(state.userId);
    }, cappedDelayMs);
  }

  private async runDue(userId: number): Promise<void> {
    const state = this.states.get(userId);
    if (!state || state.inFlight || state.pendingBookIds.size === 0) return;
    const bookIds = [...state.pendingBookIds];
    state.pendingBookIds.clear();
    state.firstPendingAtMs = null;
    state.inFlight = true;
    let nextDelayMs = READWISE_SESSIONS_PUSH_DEBOUNCE_MS;
    const startedAtMs = Date.now();
    try {
      await this.enqueue(userId, () => this.pushService.flushUser(userId, bookIds));
      state.retryAttempt = 0;
    } catch (err) {
      const durationMs = Date.now() - startedAtMs;
      const errorClass = err instanceof Error ? err.constructor.name : 'UnknownError';
      for (const bookId of bookIds) state.pendingBookIds.add(bookId);
      if (state.retryAttempt < READWISE_SESSIONS_PUSH_MAX_RETRIES) {
        state.retryAttempt += 1;
        state.firstPendingAtMs ??= Date.now();
        nextDelayMs = READWISE_SESSIONS_PUSH_RETRY_BASE_MS * Math.pow(2, state.retryAttempt - 1);
        this.logger.warn(
          `[${SCHEDULER_EVENT}] [fail] userId=${userId} count=${bookIds.length} durationMs=${durationMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" retryAttempt=${state.retryAttempt} nextDelayMs=${nextDelayMs} - sessions push failed; retry scheduled`,
        );
      } else {
        state.retryAttempt = 0;
        this.logger.error(
          `[${SCHEDULER_EVENT}] [fail] userId=${userId} count=${bookIds.length} durationMs=${durationMs} errorClass=${errorClass} error="${sanitizeLogValue(err instanceof Error ? err.message : String(err))}" retryExhausted=true - sessions push failed; retries exhausted`,
        );
      }
    } finally {
      state.inFlight = false;
      if (state.pendingBookIds.size > 0) this.schedule(state, nextDelayMs, nextDelayMs === READWISE_SESSIONS_PUSH_DEBOUNCE_MS);
      else this.states.delete(userId);
    }
  }

  private remainingMaxWaitMs(state: PushState): number {
    if (state.firstPendingAtMs === null) return READWISE_SESSIONS_PUSH_DEBOUNCE_MS;
    const elapsedMs = Date.now() - state.firstPendingAtMs;
    return Math.max(0, READWISE_SESSIONS_PUSH_MAX_WAIT_MS - elapsedMs);
  }

  private enqueue(userId: number, task: () => Promise<void>): Promise<void> {
    const previous = this.userPushQueues.get(userId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.userPushQueues.set(userId, current);
    current
      .finally(() => {
        if (this.userPushQueues.get(userId) === current) this.userPushQueues.delete(userId);
      })
      .catch(() => undefined);
    return current;
  }
}
