import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  review?: string | null;
}
