import { Module } from '@nestjs/common';

import { BookCoverStoreModule } from '../book-cover-store/book-cover-store.module';
import { BookModule } from '../book/book.module';
import { LibraryModule } from '../library/library.module';
import { AudiobookFeedAdminController } from './audiobook-feed-admin.controller';
import { AudiobookFeedPublicController } from './audiobook-feed-public.controller';
import { AudiobookFeedRepository } from './audiobook-feed.repository';
import { AudiobookFeedService } from './audiobook-feed.service';

@Module({
  imports: [BookModule, LibraryModule, BookCoverStoreModule],
  controllers: [AudiobookFeedAdminController, AudiobookFeedPublicController],
  providers: [AudiobookFeedRepository, AudiobookFeedService],
})
export class AudiobookFeedModule {}
