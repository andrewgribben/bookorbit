import { IsIn } from 'class-validator';

import { SERIES_FOLLOW_STATUSES, type SeriesFollowStatus } from '@bookorbit/types';

export class SetSeriesFollowStatusDto {
  @IsIn(SERIES_FOLLOW_STATUSES)
  status!: SeriesFollowStatus;
}
