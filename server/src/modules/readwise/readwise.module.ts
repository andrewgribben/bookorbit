import { Module } from '@nestjs/common';

import { AchievementModule } from '../achievement/achievement.module';
import { BookModule } from '../book/book.module';
import { LibraryModule } from '../library/library.module';
import { ReadingServicesModule } from '../reading-services/reading-services.module';
import { UserBookStatusModule } from '../user-book-status/user-book-status.module';
import { ReadwiseController } from './readwise.controller';
import { ReadwiseAutoSyncSchedulerService } from './readwise-auto-sync-scheduler.service';
import { ReadwiseBooksClientService } from './readwise-books-client.service';
import { ReadwiseBooksEventListener } from './readwise-books-event-listener.service';
import { ReadwiseBooksLocalBooksRepository } from './readwise-books-local-books.repository';
import { ReadwiseBooksMigrationService } from './readwise-books-migration.service';
import { ReadwiseBooksPullService } from './readwise-books-pull.service';
import { ReadwiseBooksPushSchedulerService } from './readwise-books-push-scheduler.service';
import { ReadwiseBooksPushService } from './readwise-books-push.service';
import { ReadwiseClientService } from './readwise-client.service';
import { ReadwiseEventListener } from './readwise-event-listener.service';
import { ReadwiseQueueService } from './readwise-queue.service';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSettingsService } from './readwise-settings.service';
import { ReadwiseSyncService } from './readwise-sync.service';
import { ReadwiseTokenService } from './readwise-token.service';

@Module({
  imports: [AchievementModule, ReadingServicesModule, LibraryModule, BookModule, UserBookStatusModule],
  controllers: [ReadwiseController],
  providers: [
    ReadwiseQueueService,
    ReadwiseClientService,
    ReadwiseRepository,
    ReadwiseSettingsService,
    ReadwiseTokenService,
    ReadwiseSyncService,
    ReadwiseAutoSyncSchedulerService,
    ReadwiseEventListener,
    ReadwiseBooksClientService,
    ReadwiseBooksLocalBooksRepository,
    ReadwiseBooksMigrationService,
    ReadwiseBooksPushService,
    ReadwiseBooksPushSchedulerService,
    ReadwiseBooksEventListener,
    ReadwiseBooksPullService,
  ],
  exports: [ReadwiseSettingsService, ReadwiseSyncService],
})
export class ReadwiseModule {}
