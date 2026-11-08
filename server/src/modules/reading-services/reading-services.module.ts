import { Module } from '@nestjs/common';

import { LibraryModule } from '../library/library.module';
import { ReadingServiceCacheService } from './reading-service-cache.service';
import { ReadingServiceFeaturesService } from './reading-service-features.service';
import { ReadingServiceMatchRepository } from './reading-service-match.repository';
import { ReadingServicePrivateAdapterLoaderService } from './reading-service-private-adapter-loader.service';
import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServiceSyncRunService } from './reading-service-sync-run.service';
import { ReadingServiceTokenService } from './reading-service-token.service';
import { ReadingServicesController } from './reading-services.controller';
import { ReadingServicesRepository } from './reading-services.repository';

@Module({
  imports: [LibraryModule],
  controllers: [ReadingServicesController],
  providers: [
    ReadingServicesRepository,
    ReadingServiceRegistry,
    ReadingServiceTokenService,
    ReadingServiceFeaturesService,
    ReadingServiceCacheService,
    ReadingServiceSyncRunService,
    ReadingServicePrivateAdapterLoaderService,
    ReadingServiceMatchRepository,
  ],
  exports: [
    ReadingServiceRegistry,
    ReadingServiceTokenService,
    ReadingServiceCacheService,
    ReadingServiceSyncRunService,
    ReadingServiceFeaturesService,
    ReadingServiceMatchRepository,
  ],
})
export class ReadingServicesModule {}
