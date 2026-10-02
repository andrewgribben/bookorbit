import { IsBoolean } from 'class-validator';

export class SetAudiobookFeedDto {
  @IsBoolean()
  enabled!: boolean;
}
