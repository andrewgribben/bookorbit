import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  ACHIEVEMENT_EVENT_READING_SESSION_SAVED,
  AchievementEventsService,
  type ReadingSessionSavedPayload,
} from '../achievement/achievement-events.service';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import { ReadwiseSessionsPushSchedulerService } from './readwise-sessions-push-scheduler.service';

/** Feeds the S4 sessions push scheduler from `reading-session.saved`, resolving bookFileId -> bookId. */
@Injectable()
export class ReadwiseSessionsEventListener implements OnModuleInit {
  constructor(
    private readonly achievementEvents: AchievementEventsService,
    private readonly scheduler: ReadwiseSessionsPushSchedulerService,
    private readonly sessionsRepo: ReadwiseSessionsLocalRepository,
  ) {}

  onModuleInit(): void {
    this.achievementEvents.on(ACHIEVEMENT_EVENT_READING_SESSION_SAVED, (payload: ReadingSessionSavedPayload) => {
      void this.handleReadingSessionSaved(payload);
    });
  }

  private async handleReadingSessionSaved(payload: ReadingSessionSavedPayload): Promise<void> {
    // A session saved by the Readwise pull itself has no bookFileId and never raises this event
    // (see `ReadwiseSessionsLocalRepository.insertPulledSession`), so no echo-suppression is
    // needed here the way the books push listener needs it.
    const bookId = await this.sessionsRepo.resolveBookIdForFile(payload.bookFileId);
    if (bookId === null) return;
    this.scheduler.requestPush(payload.userId, [bookId]);
  }
}
