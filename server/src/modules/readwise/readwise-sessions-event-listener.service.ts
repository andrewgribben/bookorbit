import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  ACHIEVEMENT_EVENT_READING_SESSION_SAVED,
  ACHIEVEMENT_EVENT_READING_SESSIONS_BACKFILLED,
  AchievementEventsService,
  type ReadingSessionSavedPayload,
  type ReadingSessionsBackfilledPayload,
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
    this.achievementEvents.on(ACHIEVEMENT_EVENT_READING_SESSIONS_BACKFILLED, (payload: ReadingSessionsBackfilledPayload) => {
      void this.handleReadingSessionsBackfilled(payload);
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

  /**
   * A large KOReader upload emits this instead of one `READING_SESSION_SAVED` per session (see
   * `KoreaderStatsService.emitSessionAchievements`), so without this handler those sessions
   * would never get a Readwise push requested for their books at all.
   */
  private async handleReadingSessionsBackfilled(payload: ReadingSessionsBackfilledPayload): Promise<void> {
    const bookIds = new Set<number>();
    for (const bookFileId of payload.bookFileIds) {
      const bookId = await this.sessionsRepo.resolveBookIdForFile(bookFileId);
      if (bookId !== null) bookIds.add(bookId);
    }
    if (bookIds.size > 0) this.scheduler.requestPush(payload.userId, [...bookIds]);
  }
}
