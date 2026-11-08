import { describe, expect, it, vi } from 'vitest';

import { ACHIEVEMENT_EVENT_READING_SESSION_SAVED, AchievementEventsService } from '../achievement/achievement-events.service';
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
});
