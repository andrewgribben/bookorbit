import { IsBoolean, IsObject, IsOptional } from 'class-validator';

/**
 * `PUT /reading-services/:provider/libraries/:libraryId` body. Both fields are optional so a
 * caller can update just `enabled` or just `features` without clobbering the other; omitting a
 * field entirely leaves it at its current value (service layer fills in "inherit" defaults for a
 * library that has no row yet). Feature keys are validated server-side against the known
 * `ReadingServiceFeature` list; unknown keys are dropped rather than rejected.
 */
export class UpdateReadingServiceLibraryDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsObject()
  features?: Partial<Record<string, boolean>>;

  /** Comic series mode (Readwise only): see `ReadingServiceLibrarySetting.seriesMode` in @bookorbit/types. */
  @IsOptional()
  @IsBoolean()
  seriesMode?: boolean;
}
