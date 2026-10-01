import { Module } from '@nestjs/common';

import { CommonModule } from '../../common/common.module';
import { BookModule } from '../book/book.module';
import { CollectionModule } from '../collection/collection.module';
import { LibraryModule } from '../library/library.module';
import { CbzModule } from '../reader/cbz/cbz.module';
import { EpubModule } from '../reader/epub/epub.module';
import { SeriesModule } from '../series/series.module';
import { UserModule } from '../user/user.module';
import { KomgaApiKeyAdminController } from './komga-api-key-admin.controller';
import { KomgaApiKeyService } from './komga-api-key.service';
import { KomgaAuthGuard } from './komga-auth.guard';
import { KomgaAuthService } from './komga-auth.service';
import { KomgaBookController } from './komga-book.controller';
import { KomgaBookQueryService } from './komga-book-query.service';
import { KomgaBookService } from './komga-book.service';
import { KomgaCollectionController } from './komga-collection.controller';
import { KomgaCollectionService } from './komga-collection.service';
import { KomgaFallbackController } from './komga-fallback.controller';
import { KomgaLibraryController } from './komga-library.controller';
import { KomgaReadListController } from './komga-readlist.controller';
import { KomgaReadListService } from './komga-readlist.service';
import { KomgaRepository } from './komga.repository';
import { KomgaSeriesController } from './komga-series.controller';
import { KomgaSeriesService } from './komga-series.service';
import { KomgaSessionService } from './komga-session.service';
import { KomgaSystemController } from './komga-system.controller';
import { KomgaUserController } from './komga-user.controller';

@Module({
  imports: [BookModule, CollectionModule, LibraryModule, CbzModule, EpubModule, SeriesModule, UserModule, CommonModule],
  controllers: [
    KomgaUserController,
    KomgaLibraryController,
    KomgaSystemController,
    KomgaApiKeyAdminController,
    KomgaSeriesController,
    KomgaBookController,
    KomgaCollectionController,
    KomgaReadListController,
    KomgaFallbackController,
  ],
  providers: [
    KomgaRepository,
    KomgaAuthService,
    KomgaAuthGuard,
    KomgaApiKeyService,
    KomgaBookQueryService,
    KomgaBookService,
    KomgaSeriesService,
    KomgaCollectionService,
    KomgaReadListService,
    KomgaSessionService,
  ],
})
export class KomgaApiModule {}
