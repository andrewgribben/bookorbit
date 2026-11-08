import { Module } from '@nestjs/common';

import { AchievementModule } from '../achievement/achievement.module';
import { LibraryModule } from '../library/library.module';
import { ReadingServicesModule } from '../reading-services/reading-services.module';
import { ReadwiseController } from './readwise.controller';
import { ReadwiseAutoSyncSchedulerService } from './readwise-auto-sync-scheduler.service';
import { ReadwiseBooksClientService } from './readwise-books-client.service';
import { ReadwiseBooksLocalBooksRepository } from './readwise-books-local-books.repository';
import { ReadwiseBooksMigrationService } from './readwise-books-migration.service';
import { ReadwiseClientService } from './readwise-client.service';
import { ReadwiseEventListener } from './readwise-event-listener.service';
import { ReadwiseQueueService } from './readwise-queue.service';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';
import { ReadwiseSyncService } from './readwise-sync.service';

@Module({
  imports: [AchievementModule, ReadingServicesModule, LibraryModule],
  controllers: [ReadwiseController],
  providers: [
    ReadwiseQueueService,
    ReadwiseClientService,
    ReadwiseRepository,
    ReadwiseSettingsService,
    ReadwiseSyncService,
    ReadwiseAutoSyncSchedulerService,
    ReadwiseEventListener,
    ReadwiseBooksClientService,
    ReadwiseBooksLocalBooksRepository,
    ReadwiseBooksMigrationService,
  ],
  exports: [ReadwiseSettingsService, ReadwiseSyncService],
})
export class ReadwiseModule {}
