import 'reflect-metadata';

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { UpdateReadingServiceFeaturesDto } from './reading-services.dto';

function toDto(plain: Record<string, unknown>): UpdateReadingServiceFeaturesDto {
  return plainToInstance(UpdateReadingServiceFeaturesDto, plain);
}

describe('UpdateReadingServiceFeaturesDto', () => {
  it('accepts known feature keys with boolean values', async () => {
    const dto = toDto({ features: { status: true, rating: false } });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts an empty features object', async () => {
    const dto = toDto({ features: {} });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an unknown feature key', async () => {
    const dto = toDto({ features: { bogus: true } });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-boolean value for a known feature key', async () => {
    const dto = toDto({ features: { status: 'yes' } });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an array', async () => {
    const dto = toDto({ features: ['status'] });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing features field', async () => {
    const dto = toDto({});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
