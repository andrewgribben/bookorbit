import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { LibraryModule } from '../library/library.module';
import { ReadingServiceAdvisoryLockService } from './reading-service-advisory-lock.service';
import { ReadingServiceCacheService } from './reading-service-cache.service';
import { ReadingServiceFeaturesService } from './reading-service-features.service';
import { ReadingServiceLibraryScopeService } from './reading-service-library-scope.service';
import { ReadingServiceMatchRepository } from './reading-service-match.repository';
import { ReadingServicePrivateAdapterLoaderService } from './reading-service-private-adapter-loader.service';
import { ReadingServicePrivateCredentialService } from './reading-service-private-credential.service';
import { ReadingServiceRegistry } from './reading-service-registry.service';
import { ReadingServiceSyncRunService } from './reading-service-sync-run.service';
import { ReadingServiceTokenService } from './reading-service-token.service';
import { ReadingServicesController } from './reading-services.controller';
import { ReadingServicesRepository } from './reading-services.repository';

@Module({
  imports: [CommonModule, LibraryModule],
  controllers: [ReadingServicesController],
  providers: [
    ReadingServicesRepository,
    ReadingServiceRegistry,
    ReadingServiceTokenService,
    ReadingServicePrivateCredentialService,
    ReadingServiceFeaturesService,
    ReadingServiceCacheService,
    ReadingServiceSyncRunService,
    ReadingServicePrivateAdapterLoaderService,
    ReadingServiceMatchRepository,
    ReadingServiceLibraryScopeService,
    ReadingServiceAdvisoryLockService,
  ],
  exports: [
    ReadingServicesRepository,
    ReadingServiceRegistry,
    ReadingServiceTokenService,
    ReadingServicePrivateCredentialService,
    ReadingServiceCacheService,
    ReadingServiceSyncRunService,
    ReadingServiceFeaturesService,
    ReadingServiceMatchRepository,
    ReadingServiceLibraryScopeService,
    ReadingServiceAdvisoryLockService,
  ],
})
export class ReadingServicesModule {}
