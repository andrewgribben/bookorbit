import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReadwiseBooksPushSchedulerService } from './readwise-books-push-scheduler.service';
import { READWISE_BOOKS_PUSH_DEBOUNCE_MS } from './readwise.constants';
import { ReadwiseBooksPushService } from './readwise-books-push.service';

const mockPushService = { flushUser: vi.fn() };

describe('ReadwiseBooksPushSchedulerService', () => {
  let service: ReadwiseBooksPushSchedulerService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockPushService.flushUser.mockResolvedValue(undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    service = new ReadwiseBooksPushSchedulerService(mockPushService as unknown as ReadwiseBooksPushService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('batches multiple book ids within the debounce window into one flush', async () => {
    service.requestPush(1, [10]);
    await vi.advanceTimersByTimeAsync(500);
    service.requestPush(1, [11]);
    service.requestPush(1, [10]); // duplicate, must not appear twice

    await vi.runAllTimersAsync();

    expect(mockPushService.flushUser).toHaveBeenCalledTimes(1);
    const [userId, bookIds] = mockPushService.flushUser.mock.calls[0];
    expect(userId).toBe(1);
    expect([...bookIds].sort()).toEqual([10, 11]);
  });

  it('flushes independently per user', async () => {
    service.requestPush(1, [10]);
    service.requestPush(2, [20]);

    await vi.runAllTimersAsync();

    expect(mockPushService.flushUser).toHaveBeenCalledWith(1, [10]);
    expect(mockPushService.flushUser).toHaveBeenCalledWith(2, [20]);
  });

  it('ignores an empty book id list', async () => {
    service.requestPush(1, []);
    await vi.runAllTimersAsync();
    expect(mockPushService.flushUser).not.toHaveBeenCalled();
  });

  it('retries a failed flush and re-queues the book ids', async () => {
    mockPushService.flushUser.mockRejectedValueOnce(new Error('boom'));
    service.requestPush(1, [10]);
    await vi.advanceTimersByTimeAsync(READWISE_BOOKS_PUSH_DEBOUNCE_MS);
    expect(mockPushService.flushUser).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    expect(mockPushService.flushUser).toHaveBeenCalledTimes(2);
    expect(mockPushService.flushUser).toHaveBeenNthCalledWith(2, 1, [10]);
  });
});
