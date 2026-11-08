import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACHIEVEMENT_EVENT_ANNOTATION_CREATED,
  ACHIEVEMENT_EVENT_ANNOTATION_UPDATED,
  ACHIEVEMENT_EVENT_ANNOTATION_DELETED,
  AchievementEventsService,
} from '../achievement/achievement-events.service';
import { ReadwiseAutoSyncSchedulerService } from './readwise-auto-sync-scheduler.service';
import { ReadwiseEventListener } from './readwise-event-listener.service';

const mockScheduler = {
  requestSync: vi.fn(),
};

function makeListener() {
  const events = new AchievementEventsService();
  const listener = new ReadwiseEventListener(events, mockScheduler as unknown as ReadwiseAutoSyncSchedulerService);
  listener.onModuleInit();
  return { events };
}

describe('ReadwiseEventListener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requests a sync for the user when an annotation is created', () => {
    const { events } = makeListener();

    events.emit(ACHIEVEMENT_EVENT_ANNOTATION_CREATED, { userId: 7, bookId: 1, annotationId: 42 });

    expect(mockScheduler.requestSync).toHaveBeenCalledTimes(1);
    expect(mockScheduler.requestSync).toHaveBeenCalledWith(7);
  });

  it('requests a sync for the user when an annotation is updated', () => {
    const { events } = makeListener();

    events.emit(ACHIEVEMENT_EVENT_ANNOTATION_UPDATED, { userId: 8, bookId: 1, annotationId: 43 });

    expect(mockScheduler.requestSync).toHaveBeenCalledTimes(1);
    expect(mockScheduler.requestSync).toHaveBeenCalledWith(8);
  });

  it('requests a sync for the user when an annotation is deleted', () => {
    const { events } = makeListener();

    events.emit(ACHIEVEMENT_EVENT_ANNOTATION_DELETED, { userId: 9, bookId: 1, annotationId: 44 });

    expect(mockScheduler.requestSync).toHaveBeenCalledTimes(1);
    expect(mockScheduler.requestSync).toHaveBeenCalledWith(9);
  });
});
