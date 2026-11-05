import { Module } from '@nestjs/common';

import { BookModule } from '../book/book.module';
import { LibraryModule } from '../library/library.module';
import { MigrationModule } from '../migration/migration.module';
import { SeriesModule } from '../series/series.module';
import { ReaderImportController } from './reader-import.controller';
import { ReaderImportRepository } from './reader-import.repository';
import { ReaderImportService } from './reader-import.service';

@Module({
  imports: [BookModule, LibraryModule, MigrationModule, SeriesModule],
  controllers: [ReaderImportController],
  providers: [ReaderImportService, ReaderImportRepository],
})
export class ReaderImportModule {}
