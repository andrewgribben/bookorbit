import { USER_BOOK_REVIEW_MAX_LENGTH } from '../user-book-review/user-book-review.service';

/**
 * Normalises a review value for the Readwise Books API, which accepts a string of 1-10000
 * characters or `null` (readwise-api.md §2) and may reject an empty string. Every push path
 * (books push, migration create/update) and the pull path (snapshot bookkeeping) must run the
 * value through this before it reaches Readwise or a local snapshot, so trimmed-empty values
 * never round-trip as an API-rejected empty string.
 */
export function normalizeReadwiseReview(review: string | null | undefined): string | null {
  if (review == null) return null;
  const trimmed = review.trim();
  if (trimmed === '') return null;
  return trimmed.length > USER_BOOK_REVIEW_MAX_LENGTH ? trimmed.slice(0, USER_BOOK_REVIEW_MAX_LENGTH) : trimmed;
}
