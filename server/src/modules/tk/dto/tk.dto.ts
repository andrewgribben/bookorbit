import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertTkSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  syncAnnotations?: boolean;

  @IsOptional()
  @IsBoolean()
  syncJournal?: boolean;

  @IsOptional()
  @IsBoolean()
  syncFinished?: boolean;
}

export class TkConnectStartDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientName?: string;
}

export class TkConnectFinishDto {
  @IsString()
  @MaxLength(4096)
  callbackUrl!: string;
}
