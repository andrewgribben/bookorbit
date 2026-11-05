import { IsIn, ValidateIf } from 'class-validator';

import { SERIES_FOLLOW_STATUSES, type SeriesFollowStatus } from '@bookorbit/types';
import { BulkSelectionDto } from '../../../common/dto/bulk-selection.dto';

export class BulkSetSeriesFollowStatusDto extends BulkSelectionDto {
  /** null clears the status of every series the selected books belong to. */
  @ValidateIf((dto: BulkSetSeriesFollowStatusDto) => dto.status !== null)
  @IsIn(SERIES_FOLLOW_STATUSES)
  status!: SeriesFollowStatus | null;
}
