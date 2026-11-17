import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  ACHIEVEMENT_EVENT_ANNOTATION_CREATED,
  ACHIEVEMENT_EVENT_BOOK_JOURNAL_CREATED,
  ACHIEVEMENT_EVENT_BOOK_STATUS_CHANGED,
  AchievementEventsService,
  type AnnotationCreatedPayload,
  type BookJournalCreatedPayload,
  type BookStatusChangedPayload,
} from '../achievement/achievement-events.service';
import { TkAutoSyncSchedulerService } from './tk-auto-sync-scheduler.service';

@Injectable()
export class TkEventListener implements OnModuleInit {
  constructor(
    private readonly achievementEvents: AchievementEventsService,
    private readonly scheduler: TkAutoSyncSchedulerService,
  ) {}

  onModuleInit(): void {
    this.achievementEvents.on(ACHIEVEMENT_EVENT_ANNOTATION_CREATED, (payload: AnnotationCreatedPayload) => {
      this.scheduler.requestSync(payload.userId);
    });
    this.achievementEvents.on(ACHIEVEMENT_EVENT_BOOK_JOURNAL_CREATED, (payload: BookJournalCreatedPayload) => {
      this.scheduler.requestSync(payload.userId);
    });
    // Other status changes (want_to_read, abandoned, skimmed, ...) are not a "finished book" event.
    this.achievementEvents.on(ACHIEVEMENT_EVENT_BOOK_STATUS_CHANGED, (payload: BookStatusChangedPayload) => {
      if (payload.newStatus === 'read') this.scheduler.requestSync(payload.userId);
    });
  }
}
