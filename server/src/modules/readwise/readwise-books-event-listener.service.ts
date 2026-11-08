import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  ACHIEVEMENT_EVENT_BOOK_RATING_CHANGED,
  ACHIEVEMENT_EVENT_BOOK_STATUS_CHANGED,
  AchievementEventsService,
  type BookRatingChangedPayload,
  type BookStatusChangedPayload,
} from '../achievement/achievement-events.service';
import { ReadwiseBooksPushSchedulerService } from './readwise-books-push-scheduler.service';

/** Feeds the S3 books push scheduler from the status/rating domain events. */
@Injectable()
export class ReadwiseBooksEventListener implements OnModuleInit {
  constructor(
    private readonly achievementEvents: AchievementEventsService,
    private readonly scheduler: ReadwiseBooksPushSchedulerService,
  ) {}

  onModuleInit(): void {
    this.achievementEvents.on(ACHIEVEMENT_EVENT_BOOK_STATUS_CHANGED, (payload: BookStatusChangedPayload) => {
      this.scheduler.requestPush(payload.userId, [payload.bookId]);
    });
    this.achievementEvents.on(ACHIEVEMENT_EVENT_BOOK_RATING_CHANGED, (payload: BookRatingChangedPayload) => {
      this.scheduler.requestPush(payload.userId, payload.bookIds);
    });
  }
}
