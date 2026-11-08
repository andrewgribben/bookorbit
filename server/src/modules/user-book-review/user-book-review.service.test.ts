import { beforeEach, describe, expect, it, vi } from 'vitest';

import { USER_BOOK_REVIEW_MAX_LENGTH, UserBookReviewService } from './user-book-review.service';

describe('UserBookReviewService', () => {
  let repo: {
    findOne: ReturnType<typeof vi.fn>;
    findByBookIds: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    upsertMany: ReturnType<typeof vi.fn>;
  };
  let service: UserBookReviewService;

  beforeEach(() => {
    repo = {
      findOne: vi.fn(),
      findByBookIds: vi.fn(),
      upsert: vi.fn(),
      upsertMany: vi.fn(),
    };
    service = new UserBookReviewService(repo as never);
  });

  it('normalizes blank reviews to null and trims text', async () => {
    const updatedAt = new Date('2026-07-01T12:00:00.000Z');
    repo.upsert.mockResolvedValue({ userId: 1, bookId: 2, review: 'great book', updatedAt });

    await expect(service.setReview(1, 2, '  great book  ', updatedAt)).resolves.toEqual({
      review: 'great book',
      updatedAt: '2026-07-01T12:00:00.000Z',
    });
    expect(repo.upsert).toHaveBeenCalledWith(1, 2, 'great book', updatedAt);

    repo.upsert.mockResolvedValue({ userId: 1, bookId: 2, review: null, updatedAt });
    await service.setReview(1, 2, '   ', updatedAt);
    expect(repo.upsert).toHaveBeenLastCalledWith(1, 2, null, updatedAt);
  });

  it('caps reviews at the 10,000 character sync contract limit', () => {
    const value = 'a'.repeat(USER_BOOK_REVIEW_MAX_LENGTH + 10);

    expect(service.normalizeReview(value)).toHaveLength(USER_BOOK_REVIEW_MAX_LENGTH);
  });

  it('findOne maps the repository row to a dto and returns null when missing', async () => {
    const updatedAt = new Date('2026-07-02T00:00:00.000Z');
    repo.findOne.mockResolvedValue({ userId: 1, bookId: 2, review: 'great book', updatedAt });

    await expect(service.findOne(1, 2)).resolves.toEqual({ review: 'great book', updatedAt: '2026-07-02T00:00:00.000Z' });

    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne(1, 2)).resolves.toBeNull();
  });

  it('setReviews normalizes every entry and writes one row per book', async () => {
    const updatedAt = new Date('2026-07-03T00:00:00.000Z');

    await service.setReviews(
      1,
      [
        { bookId: 2, review: '  great book  ' },
        { bookId: 3, review: '   ' },
      ],
      updatedAt,
    );

    expect(repo.upsertMany).toHaveBeenCalledWith(
      1,
      [
        { bookId: 2, review: 'great book' },
        { bookId: 3, review: null },
      ],
      updatedAt,
    );
  });

  it('setReviews keeps the last entry when several resolve to one book', async () => {
    const updatedAt = new Date('2026-07-03T00:00:00.000Z');

    await service.setReviews(
      1,
      [
        { bookId: 2, review: 'first' },
        { bookId: 2, review: 'second' },
      ],
      updatedAt,
    );

    expect(repo.upsertMany).toHaveBeenCalledWith(1, [{ bookId: 2, review: 'second' }], updatedAt);
  });

  it('setReviews writes nothing for an empty entry list', async () => {
    await service.setReviews(1, []);

    expect(repo.upsertMany).not.toHaveBeenCalled();
  });

  it('findByBookIds maps rows by book id', async () => {
    const updatedAt = new Date('2026-07-04T00:00:00.000Z');
    repo.findByBookIds.mockResolvedValue([
      { userId: 1, bookId: 2, review: 'a', updatedAt },
      { userId: 1, bookId: 3, review: null, updatedAt },
    ]);

    const result = await service.findByBookIds(1, [2, 3]);

    expect(repo.findByBookIds).toHaveBeenCalledWith(1, [2, 3]);
    expect(result.get(2)).toEqual({ review: 'a', updatedAt: '2026-07-04T00:00:00.000Z' });
    expect(result.get(3)).toEqual({ review: null, updatedAt: '2026-07-04T00:00:00.000Z' });
  });
});
