import { describe, expect, it, vi } from 'vitest';

import {
  ACHIEVEMENT_EVENT_READING_SESSION_SAVED,
  ACHIEVEMENT_EVENT_READING_SESSIONS_BACKFILLED,
  AchievementEventsService,
} from '../achievement/achievement-events.service';
import { ReadwiseSessionsEventListener } from './readwise-sessions-event-listener.service';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import { ReadwiseSessionsPushSchedulerService } from './readwise-sessions-push-scheduler.service';

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('ReadwiseSessionsEventListener', () => {
  it('resolves bookFileId to bookId and queues a push', async () => {
    const events = new AchievementEventsService();
    const scheduler = { requestPush: vi.fn() } as unknown as ReadwiseSessionsPushSchedulerService;
    const sessionsRepo = { resolveBookIdForFile: vi.fn().mockResolvedValue(42) } as unknown as ReadwiseSessionsLocalRepository;
    const listener = new ReadwiseSessionsEventListener(events, scheduler, sessionsRepo);
    listener.onModuleInit();

    events.emit(ACHIEVEMENT_EVENT_READING_SESSION_SAVED, {
      userId: 1,
      bookFileId: 7,
      durationSeconds: 120,
      startedAt: new Date(),
      endedAt: new Date(),
      progressDelta: 1,
      endProgress: 10,
      timezone: 'UTC',
      source: 'web',
    });
    await flush();

    expect(sessionsRepo.resolveBookIdForFile).toHaveBeenCalledWith(7);
    expect(scheduler.requestPush).toHaveBeenCalledWith(1, [42]);
  });

  it('does nothing when the file cannot be resolved to a book', async () => {
    const events = new AchievementEventsService();
    const scheduler = { requestPush: vi.fn() } as unknown as ReadwiseSessionsPushSchedulerService;
    const sessionsRepo = { resolveBookIdForFile: vi.fn().mockResolvedValue(null) } as unknown as ReadwiseSessionsLocalRepository;
    const listener = new ReadwiseSessionsEventListener(events, scheduler, sessionsRepo);
    listener.onModuleInit();

    events.emit(ACHIEVEMENT_EVENT_READING_SESSION_SAVED, {
      userId: 1,
      bookFileId: 9,
      durationSeconds: 120,
      startedAt: new Date(),
      endedAt: new Date(),
      progressDelta: null,
      endProgress: null,
      timezone: 'UTC',
      source: 'web',
    });
    await flush();

    expect(scheduler.requestPush).not.toHaveBeenCalled();
  });

  it('resolves every bookFileId in a backfilled event and requests one deduped push', async () => {
    const events = new AchievementEventsService();
    const scheduler = { requestPush: vi.fn() } as unknown as ReadwiseSessionsPushSchedulerService;
    const resolveBookIdForFile = vi.fn((bookFileId: number) => Promise.resolve(bookFileId === 7 ? 42 : bookFileId === 8 ? 42 : null));
    const sessionsRepo = { resolveBookIdForFile } as unknown as ReadwiseSessionsLocalRepository;
    const listener = new ReadwiseSessionsEventListener(events, scheduler, sessionsRepo);
    listener.onModuleInit();

    events.emit(ACHIEVEMENT_EVENT_READING_SESSIONS_BACKFILLED, { userId: 1, bookFileIds: [7, 8, 9] });
    await flush();

    expect(resolveBookIdForFile).toHaveBeenCalledTimes(3);
    expect(scheduler.requestPush).toHaveBeenCalledWith(1, [42]);
  });

  it('does nothing for a backfilled event whose files resolve to no books', async () => {
    const events = new AchievementEventsService();
    const scheduler = { requestPush: vi.fn() } as unknown as ReadwiseSessionsPushSchedulerService;
    const sessionsRepo = { resolveBookIdForFile: vi.fn().mockResolvedValue(null) } as unknown as ReadwiseSessionsLocalRepository;
    const listener = new ReadwiseSessionsEventListener(events, scheduler, sessionsRepo);
    listener.onModuleInit();

    events.emit(ACHIEVEMENT_EVENT_READING_SESSIONS_BACKFILLED, { userId: 1, bookFileIds: [9] });
    await flush();

    expect(scheduler.requestPush).not.toHaveBeenCalled();
  });
});
