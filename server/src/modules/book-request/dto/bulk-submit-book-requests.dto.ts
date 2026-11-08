import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsOptional, IsString, IsUrl, MaxLength, ValidateNested } from 'class-validator';
import { BOOK_REQUEST_BULK_LIMIT } from '@bookorbit/types';
import type { BulkSubmitBookRequestItem, BulkSubmitBookRequestsPayload } from '@bookorbit/types';

/**
 * One row of a "request all" batch filed from outside the request form (the Readwise-only list,
 * the owned-elsewhere shelf). Deliberately thinner than `BookRequestWorkDto`: the caller never
 * asked the requester for a destination, formats or an ISBN, so there is nothing to send for them.
 */
export class BulkSubmitBookRequestItemDto implements BulkSubmitBookRequestItem {
  @IsString()
  @MaxLength(255)
  externalId!: string;

  @IsString()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  authors?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false }, { message: 'coverUrl must be an http or https address' })
  coverUrl?: string;
}

export class BulkSubmitBookRequestsDto implements BulkSubmitBookRequestsPayload {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(BOOK_REQUEST_BULK_LIMIT)
  @ValidateNested({ each: true })
  @Type(() => BulkSubmitBookRequestItemDto)
  items!: BulkSubmitBookRequestItemDto[];
}
