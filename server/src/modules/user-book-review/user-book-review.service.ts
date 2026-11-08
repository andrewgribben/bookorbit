import { Injectable } from '@nestjs/common';

import type { UserBookReviewRow } from '../../db/schema';
import { UserBookReviewRepository } from './user-book-review.repository';

// Matches Readwise's documented hard cap on its own `review` field (readwise-api.md §2), so a
// value BookOrbit accepts locally can never be silently truncated when it syncs out.
export const USER_BOOK_REVIEW_MAX_LENGTH = 10000;

export interface UserBookReviewDto {
  review: string | null;
  updatedAt: string;
}

@Injectable()
export class UserBookReviewService {
  constructor(private readonly repo: UserBookReviewRepository) {}

  async findOne(userId: number, bookId: number): Promise<UserBookReviewDto | null> {
    const row = await this.repo.findOne(userId, bookId);
    return row ? this.toDto(row) : null;
  }

  async findByBookIds(userId: number, bookIds: number[]): Promise<Map<number, UserBookReviewDto>> {
    const rows = await this.repo.findByBookIds(userId, bookIds);
    const map = new Map<number, UserBookReviewDto>();
    for (const row of rows) {
      map.set(row.bookId, this.toDto(row));
    }
    return map;
  }

  async setReview(userId: number, bookId: number, rawReview: string | null | undefined, updatedAt = new Date()): Promise<UserBookReviewDto> {
    const review = this.normalizeReview(rawReview);
    const row = await this.repo.upsert(userId, bookId, review, updatedAt);
    return this.toDto(row);
  }

  async setReviews(userId: number, entries: { bookId: number; review: string | null | undefined }[], updatedAt = new Date()): Promise<void> {
    if (entries.length === 0) return;
    // Later entries win so a caller that resolved several device records to one book
    // still produces a single conflict-free row per book.
    const byBook = new Map<number, string | null>();
    for (const entry of entries) {
      byBook.set(entry.bookId, this.normalizeReview(entry.review));
    }
    await this.repo.upsertMany(
      userId,
      [...byBook].map(([bookId, review]) => ({ bookId, review })),
      updatedAt,
    );
  }

  normalizeReview(rawReview: string | null | undefined): string | null {
    if (rawReview == null) return null;
    const trimmed = rawReview.trim();
    if (trimmed === '') return null;
    return trimmed.length > USER_BOOK_REVIEW_MAX_LENGTH ? trimmed.slice(0, USER_BOOK_REVIEW_MAX_LENGTH) : trimmed;
  }

  private toDto(row: UserBookReviewRow): UserBookReviewDto {
    return {
      review: row.review ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
