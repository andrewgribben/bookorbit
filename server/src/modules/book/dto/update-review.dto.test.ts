import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateReviewDto } from './update-review.dto';

describe('UpdateReviewDto', () => {
  it('accepts a review within the 10,000 character limit', async () => {
    const dto = plainToInstance(UpdateReviewDto, { review: 'A thoughtful review of this book.' });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a null review to clear it', async () => {
    const dto = plainToInstance(UpdateReviewDto, { review: null });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a missing review key (leaves the review unchanged)', async () => {
    const dto = plainToInstance(UpdateReviewDto, {});

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a review over 10,000 characters', async () => {
    const dto = plainToInstance(UpdateReviewDto, { review: 'a'.repeat(10001) });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});
