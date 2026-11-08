import { Module } from '@nestjs/common';

import { ReadingServiceCacheService } from './reading-service-cache.service';
import { ReadingServiceFeaturesService } from './reading-service-features.service';
import { ReadingServicePrivateAdapterLoaderService } from './reading-service-private-adapter-loader.service';
import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServiceSyncRunService } from './reading-service-sync-run.service';
import { ReadingServiceTokenService } from './reading-service-token.service';
import { ReadingServicesController } from './reading-services.controller';
import { ReadingServicesRepository } from './reading-services.repository';

@Module({
  controllers: [ReadingServicesController],
  providers: [
    ReadingServicesRepository,
    ReadingServiceRegistry,
    ReadingServiceTokenService,
    ReadingServiceFeaturesService,
    ReadingServiceCacheService,
    ReadingServiceSyncRunService,
    ReadingServicePrivateAdapterLoaderService,
  ],
  exports: [
    ReadingServicesRepository,
    ReadingServiceRegistry,
    ReadingServiceTokenService,
    ReadingServiceCacheService,
    ReadingServiceSyncRunService,
    ReadingServiceFeaturesService,
  ],
})
export class ReadingServicesModule {}
