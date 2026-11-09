import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReadwiseSessionsPushSchedulerService } from './readwise-sessions-push-scheduler.service';
import type { ReadwiseSessionsPushService } from './readwise-sessions-push.service';

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function makeScheduler(flushUserImpl?: (...args: unknown[]) => Promise<unknown>) {
  const pushService = {
    flushUser: vi.fn(flushUserImpl ?? (() => Promise.resolve({ settleRetries: [] }))),
  } as unknown as ReadwiseSessionsPushService;
  const scheduler = new ReadwiseSessionsPushSchedulerService(pushService);
  return { scheduler, pushService };
}

describe('ReadwiseSessionsPushSchedulerService', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
  afterEach(() => vi.useRealTimers());

  it('debounces repeated requests into a single flush', async () => {
    const { scheduler, pushService } = makeScheduler();
    scheduler.requestPush(1, [10]);
    scheduler.requestPush(1, [11]);
    await vi.advanceTimersByTimeAsync(2000);
    await flush();

    expect(pushService.flushUser).toHaveBeenCalledTimes(1);
    expect(pushService.flushUser).toHaveBeenCalledWith(1, [10, 11]);
  });

  it('schedules a settle retry for a book flushUser reports as unsettled', async () => {
    const nextSettleAt = new Date(Date.now() + 30_000);
    const { scheduler, pushService } = makeScheduler(() => Promise.resolve({ settleRetries: [{ bookId: 10, nextSettleAt }] }));

    scheduler.requestPush(1, [10]);
    await vi.advanceTimersByTimeAsync(2000);
    await flush();
    expect(pushService.flushUser).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    await flush();

    expect(pushService.flushUser).toHaveBeenCalledTimes(2);
    expect(pushService.flushUser).toHaveBeenNthCalledWith(2, 1, [10]);
  });

  it('never fires a settle retry sooner than the minimum delay', async () => {
    const nextSettleAt = new Date(Date.now() + 1000); // under the 5s floor
    const { scheduler, pushService } = makeScheduler(() => Promise.resolve({ settleRetries: [{ bookId: 10, nextSettleAt }] }));

    scheduler.requestPush(1, [10]);
    await vi.advanceTimersByTimeAsync(2000);
    await flush();
    expect(pushService.flushUser).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000); // under the 5s floor, should not have fired yet
    await flush();
    expect(pushService.flushUser).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    await flush();
    expect(pushService.flushUser).toHaveBeenCalledTimes(2);
  });

  it('uses one settle timer per user even when multiple books report a retry', async () => {
    const nextSettleAt = new Date(Date.now() + 30_000);
    const { scheduler, pushService } = makeScheduler(() =>
      Promise.resolve({
        settleRetries: [
          { bookId: 10, nextSettleAt },
          { bookId: 20, nextSettleAt },
        ],
      }),
    );

    scheduler.requestPush(1, [10, 20]);
    await vi.advanceTimersByTimeAsync(2000);
    await flush();

    await vi.advanceTimersByTimeAsync(30_000);
    await flush();
    await vi.advanceTimersByTimeAsync(2000);
    await flush();

    expect(pushService.flushUser).toHaveBeenCalledTimes(2);
    const secondCallBookIds = (pushService.flushUser as any).mock.calls[1][1] as number[];
    expect(secondCallBookIds.sort()).toEqual([10, 20]);
  });
});
