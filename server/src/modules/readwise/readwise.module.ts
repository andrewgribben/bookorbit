import { Module } from '@nestjs/common';

import { AchievementModule } from '../achievement/achievement.module';
import { BookModule } from '../book/book.module';
import { LibraryModule } from '../library/library.module';
import { ReadingServicesModule } from '../reading-services/reading-services.module';
import { UserBookReviewModule } from '../user-book-review/user-book-review.module';
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
import { ReadwiseComicSeriesRepository } from './readwise-comic-series.repository';
import { ReadwiseComicSeriesService } from './readwise-comic-series.service';
import { ReadwiseEventListener } from './readwise-event-listener.service';
import { ReadwiseHighlightsLedgerBackfillService } from './readwise-highlights-ledger-backfill.service';
import { ReadwiseHighlightsLocalRepository } from './readwise-highlights-local.repository';
import { ReadwiseHighlightsPullService } from './readwise-highlights-pull.service';
import { ReadwiseOwnedElsewhereService } from './readwise-owned-elsewhere.service';
import { ReadwiseQueueService } from './readwise-queue.service';
import { ReadwiseRecapService } from './readwise-recap.service';
import { ReadwiseRepository } from './readwise.repository';
import { ReadwiseSessionsBackfillSweepService } from './readwise-sessions-backfill-sweep.service';
import { ReadwiseSessionsEventListener } from './readwise-sessions-event-listener.service';
import { ReadwiseSessionsCorrectionService } from './readwise-sessions-correction.service';
import { ReadwiseSessionsDeleteUnlinkService } from './readwise-sessions-delete-unlink.service';
import { ReadwiseSessionsLocalRepository } from './readwise-sessions-local.repository';
import { ReadwiseSessionsPullService } from './readwise-sessions-pull.service';
import { ReadwiseSessionsPushSchedulerService } from './readwise-sessions-push-scheduler.service';
import { ReadwiseSessionsPushService } from './readwise-sessions-push.service';
import { ReadwiseSessionsReconcileService } from './readwise-sessions-reconcile.service';
import { ReadwiseSessionsRepairService } from './readwise-sessions-repair.service';
import { ReadwiseSettingsService } from './readwise-settings.service';
import { ReadwiseSyncService } from './readwise-sync.service';
import { ReadwiseTokenService } from './readwise-token.service';

@Module({
  imports: [AchievementModule, ReadingServicesModule, LibraryModule, BookModule, UserBookStatusModule, UserBookReviewModule],
  controllers: [ReadwiseController],
  providers: [
    ReadwiseQueueService,
    ReadwiseClientService,
    ReadwiseRepository,
    ReadwiseSettingsService,
    ReadwiseTokenService,
    ReadwiseSyncService,
    ReadwiseHighlightsLedgerBackfillService,
    ReadwiseHighlightsLocalRepository,
    ReadwiseHighlightsPullService,
    ReadwiseAutoSyncSchedulerService,
    ReadwiseEventListener,
    ReadwiseBooksClientService,
    ReadwiseBooksLocalBooksRepository,
    ReadwiseBooksMigrationService,
    ReadwiseBooksPushService,
    ReadwiseBooksPushSchedulerService,
    ReadwiseBooksEventListener,
    ReadwiseBooksPullService,
    ReadwiseSessionsLocalRepository,
    ReadwiseSessionsDeleteUnlinkService,
    ReadwiseSessionsPushService,
    ReadwiseSessionsReconcileService,
    ReadwiseSessionsCorrectionService,
    ReadwiseSessionsRepairService,
    ReadwiseSessionsBackfillSweepService,
    ReadwiseSessionsPushSchedulerService,
    ReadwiseSessionsEventListener,
    ReadwiseSessionsPullService,
    ReadwiseRecapService,
    ReadwiseOwnedElsewhereService,
    ReadwiseComicSeriesRepository,
    ReadwiseComicSeriesService,
  ],
  exports: [ReadwiseSettingsService, ReadwiseSyncService, ReadwiseRecapService, ReadwiseOwnedElsewhereService],
})
export class ReadwiseModule {}
