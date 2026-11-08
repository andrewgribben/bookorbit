import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  ACHIEVEMENT_EVENT_ANNOTATION_CREATED,
  ACHIEVEMENT_EVENT_ANNOTATION_UPDATED,
  ACHIEVEMENT_EVENT_ANNOTATION_DELETED,
  AchievementEventsService,
  type AnnotationCreatedPayload,
  type AnnotationUpdatedPayload,
  type AnnotationDeletedPayload,
} from '../achievement/achievement-events.service';
import { ReadwiseAutoSyncSchedulerService } from './readwise-auto-sync-scheduler.service';

@Injectable()
export class ReadwiseEventListener implements OnModuleInit {
  constructor(
    private readonly achievementEvents: AchievementEventsService,
    private readonly scheduler: ReadwiseAutoSyncSchedulerService,
  ) {}

  onModuleInit(): void {
    this.achievementEvents.on(ACHIEVEMENT_EVENT_ANNOTATION_CREATED, (payload: AnnotationCreatedPayload) => {
      this.scheduler.requestSync(payload.userId);
    });
    // S5: edits and deletes feed the same debounced flush as creates - ReadwiseSyncService.flush
    // reconciles all three (create/update/delete) against the highlights ledger in one pass.
    this.achievementEvents.on(ACHIEVEMENT_EVENT_ANNOTATION_UPDATED, (payload: AnnotationUpdatedPayload) => {
      this.scheduler.requestSync(payload.userId);
    });
    this.achievementEvents.on(ACHIEVEMENT_EVENT_ANNOTATION_DELETED, (payload: AnnotationDeletedPayload) => {
      this.scheduler.requestSync(payload.userId);
    });
  }
}
