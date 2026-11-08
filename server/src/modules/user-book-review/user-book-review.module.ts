import { Module } from '@nestjs/common';

import { UserBookReviewRepository } from './user-book-review.repository';
import { UserBookReviewService } from './user-book-review.service';

@Module({
  providers: [UserBookReviewService, UserBookReviewRepository],
  exports: [UserBookReviewService],
})
export class UserBookReviewModule {}
