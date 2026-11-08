import { describe, expect, it, vi } from 'vitest';

import {
  ACHIEVEMENT_EVENT_BOOK_RATING_CHANGED,
  ACHIEVEMENT_EVENT_BOOK_REVIEW_CHANGED,
  ACHIEVEMENT_EVENT_BOOK_STATUS_CHANGED,
  AchievementEventsService,
} from '../achievement/achievement-events.service';
import { ReadwiseBooksEventListener } from './readwise-books-event-listener.service';
import { ReadwiseBooksPushSchedulerService } from './readwise-books-push-scheduler.service';

describe('ReadwiseBooksEventListener', () => {
  it('queues a push for the changed book on a status change', () => {
    const events = new AchievementEventsService();
    const scheduler = { requestPush: vi.fn() } as unknown as ReadwiseBooksPushSchedulerService;
    const listener = new ReadwiseBooksEventListener(events, scheduler);
    listener.onModuleInit();

    events.emit(ACHIEVEMENT_EVENT_BOOK_STATUS_CHANGED, { userId: 1, bookId: 10, newStatus: 'reading', previousStatus: 'unread' });

    expect(scheduler.requestPush).toHaveBeenCalledWith(1, [10]);
  });

  it('queues a push for every book in a rating change', () => {
    const events = new AchievementEventsService();
    const scheduler = { requestPush: vi.fn() } as unknown as ReadwiseBooksPushSchedulerService;
    const listener = new ReadwiseBooksEventListener(events, scheduler);
    listener.onModuleInit();

    events.emit(ACHIEVEMENT_EVENT_BOOK_RATING_CHANGED, { userId: 1, bookIds: [10, 11], rating: 4 });

    expect(scheduler.requestPush).toHaveBeenCalledWith(1, [10, 11]);
  });

  it('queues a push for the changed book on a review change', () => {
    const events = new AchievementEventsService();
    const scheduler = { requestPush: vi.fn() } as unknown as ReadwiseBooksPushSchedulerService;
    const listener = new ReadwiseBooksEventListener(events, scheduler);
    listener.onModuleInit();

    events.emit(ACHIEVEMENT_EVENT_BOOK_REVIEW_CHANGED, { userId: 1, bookId: 12, review: 'Great book' });

    expect(scheduler.requestPush).toHaveBeenCalledWith(1, [12]);
  });
});
