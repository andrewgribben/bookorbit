import { IsObject } from 'class-validator';

import type { ReadingServiceFeature } from '@bookorbit/types';

export class UpdateReadingServiceFeaturesDto {
  @IsObject()
  features!: Partial<Record<ReadingServiceFeature, boolean>>;
}
