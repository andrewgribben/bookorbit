import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import type { ReadingSessionSource } from '@bookorbit/types';

export const ACHIEVEMENT_EVENT_READING_SESSION_SAVED = 'reading-session.saved';
export const ACHIEVEMENT_EVENT_BOOK_STATUS_CHANGED = 'book.status-changed';
export const ACHIEVEMENT_EVENT_ANNOTATION_CREATED = 'annotation.created';
export const ACHIEVEMENT_EVENT_ANNOTATION_UPDATED = 'annotation.updated';
export const ACHIEVEMENT_EVENT_ANNOTATION_DELETED = 'annotation.deleted';
export const ACHIEVEMENT_EVENT_COLLECTION_CREATED = 'collection.created';
export const ACHIEVEMENT_EVENT_LIBRARY_CATALOG_CHANGED = 'library.catalog-changed';
export const ACHIEVEMENT_EVENT_BACKFILL = 'achievement.backfill';
export const ACHIEVEMENT_EVENT_READING_SESSIONS_BACKFILLED = 'reading-session.backfilled';
export const ACHIEVEMENT_EVENT_ACHIEVEMENT_AWARDED = 'achievement.awarded';
export const ACHIEVEMENT_EVENT_BOOK_RATING_CHANGED = 'book.rating-changed';
export const ACHIEVEMENT_EVENT_BOOK_PROGRESS_CHANGED = 'book.progress-changed';
export const ACHIEVEMENT_EVENT_BOOK_HARDCOVER_EDITION_CHANGED = 'book.hardcover-edition-changed';
export const ACHIEVEMENT_EVENT_BOOK_REVIEW_CHANGED = 'book.review-changed';

export interface ReadingSessionSavedPayload {
  userId: number;
  bookFileId: number;
  durationSeconds: number;
  startedAt: Date;
  endedAt: Date;
  progressDelta: number | null;
  endProgress: number | null;
  timezone: string;
  source: ReadingSessionSource;
}

/**
 * Raised instead of (not in addition to, per-session) `ACHIEVEMENT_EVENT_READING_SESSION_SAVED`
 * when an upload changes more sessions than the achievements backfill threshold, so Readwise
 * push still gets requested for the affected books even though no per-session saved event was
 * emitted for them. See `KoreaderStatsService.emitSessionAchievements`.
 */
export interface ReadingSessionsBackfilledPayload {
  userId: number;
  bookFileIds: number[];
}

export interface BookStatusChangedPayload {
  userId: number;
  bookId: number;
  newStatus: string;
  previousStatus: string | null;
}

export interface AnnotationCreatedPayload {
  userId: number;
  bookId: number;
  annotationId: number;
}

export interface AnnotationUpdatedPayload {
  userId: number;
  bookId: number;
  annotationId: number;
}

export interface AnnotationDeletedPayload {
  userId: number;
  bookId: number;
  annotationId: number;
}

export interface CollectionCreatedPayload {
  userId: number;
  collectionId: number;
}

export interface LibraryCatalogChangedPayload {
  userId: number;
  libraryId: number;
}

export interface BookRatingChangedPayload {
  userId: number;
  bookIds: number[];
  rating: number | null;
}

export interface BookProgressChangedPayload {
  userId: number;
  bookId: number;
  // Optional: Kobo syncs progress at the book level and has no single relevant file id.
  bookFileId?: number;
  progress: number;
  source: 'koreader' | 'kobo' | 'web_reader';
}

export interface BookHardcoverEditionChangedPayload {
  userId: number;
  bookId: number;
  hardcoverEditionId: string;
}

export interface BookReviewChangedPayload {
  userId: number;
  bookId: number;
  review: string | null;
}

export type AchievementEventPayload =
  | ReadingSessionSavedPayload
  | ReadingSessionsBackfilledPayload
  | BookStatusChangedPayload
  | AnnotationCreatedPayload
  | AnnotationUpdatedPayload
  | AnnotationDeletedPayload
  | CollectionCreatedPayload
  | LibraryCatalogChangedPayload
  | BookRatingChangedPayload
  | BookProgressChangedPayload
  | BookHardcoverEditionChangedPayload
  | BookReviewChangedPayload;

@Injectable()
export class AchievementEventsService extends EventEmitter {}
