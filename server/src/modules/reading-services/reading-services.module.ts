import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';

import { ReadingServiceCacheService } from './reading-service-cache.service';
import { ReadingServiceFeaturesService } from './reading-service-features.service';
import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServiceSyncRunService } from './reading-service-sync-run.service';
import { ReadingServiceTokenService } from './reading-service-token.service';
import { ReadingServicesController } from './reading-services.controller';
import { ReadingServicesRepository } from './reading-services.repository';

@Module({
  imports: [CommonModule],
  controllers: [ReadingServicesController],
  providers: [
    ReadingServicesRepository,
    ReadingServiceRegistry,
    ReadingServiceTokenService,
    ReadingServiceFeaturesService,
    ReadingServiceCacheService,
    ReadingServiceSyncRunService,
  ],
  exports: [
    ReadingServiceRegistry,
    ReadingServiceTokenService,
    ReadingServiceCacheService,
    ReadingServiceSyncRunService,
    ReadingServiceFeaturesService,
  ],
})
export class ReadingServicesModule {}
