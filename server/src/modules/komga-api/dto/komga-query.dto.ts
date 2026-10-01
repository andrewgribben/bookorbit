import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Declared even when unsupported to avoid 400 from forbidNonWhitelisted. */
export function toStringArray(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .filter((entry): entry is string | number | boolean => typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean')
    .map((entry) => String(entry));
}

export function toNumberArray(value: unknown): unknown {
  const asArray = toStringArray(value);
  if (asArray === undefined) return undefined;
  return (asArray as string[]).map((entry) => Number(entry));
}

export function toBoolean(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class KomgaPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  unpaged?: boolean;
}

export class KomgaBookQueryDto extends KomgaPageQueryDto {
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  sort?: string[];

  @IsOptional()
  @Transform(({ value }) => toNumberArray(value))
  @IsArray()
  @IsInt({ each: true })
  library_id?: number[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  read_status?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  media_status?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  tag?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  author?: string[];

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  deleted?: boolean;
}

/** Wider than mapped; ignored filters return a valid page instead of 400. */
export class KomgaSeriesQueryDto extends KomgaBookQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  search?: string;

  @IsOptional()
  @IsString()
  search_regex?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  status?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  publisher?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  language?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  genre?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  age_rating?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  release_year?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  sharing_label?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  collection_id?: string[];

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  complete?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  oneshot?: boolean;
}

export class KomgaSearchBodyDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size?: number;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  sort?: string[];

  @IsOptional()
  @Transform(({ value }) => toNumberArray(value))
  @IsArray()
  @IsInt({ each: true })
  library_id?: number[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  read_status?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  media_status?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  tag?: string[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  author?: string[];

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  deleted?: boolean;

  @IsOptional()
  @IsObject()
  condition?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  fullTextSearch?: string;
}

export class KomgaReadProgressUpdateDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  completed?: boolean;
}

export class KomgaReadListWriteDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  summary?: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  bookIds?: string[];

  @IsOptional()
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean()
  ordered?: boolean;
}

export class KomgaApiKeyRequestDto {
  @IsString()
  @MaxLength(255)
  comment!: string;
}

export class KomgaProgressionDto {
  @IsOptional()
  @IsObject()
  device?: { id?: string; name?: string };

  @IsObject()
  locator!: {
    href?: string;
    type?: string;
    title?: string;
    locations?: { position?: number; progression?: number; totalProgression?: number };
  };

  @IsOptional()
  @IsString()
  modified?: string;
}

/** `KomgaLibraryPageQueryDto` guards the collection/readlist list routes, which take no book filters. */
export class KomgaLibraryPageQueryDto extends KomgaPageQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => toNumberArray(value))
  @IsArray()
  @IsInt({ each: true })
  library_id?: number[];

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  sort?: string[];
}

/**
 * Komga clients put the same search parameters in the query string *and* the POST body, depending
 * on the client; the body wins because that is the documented `SearchRequest` carrier.
 */
export function mergeKomgaSearchQuery(query: KomgaBookQueryDto, body: KomgaSearchBodyDto): KomgaBookQueryDto {
  return {
    ...query,
    page: body.page ?? query.page,
    size: body.size ?? query.size,
    sort: body.sort ?? query.sort,
    library_id: body.library_id ?? query.library_id,
    read_status: body.read_status ?? query.read_status,
    media_status: body.media_status ?? query.media_status,
    tag: body.tag ?? query.tag,
    author: body.author ?? query.author,
    deleted: body.deleted ?? query.deleted,
  };
}
