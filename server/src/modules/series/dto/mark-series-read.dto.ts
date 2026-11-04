import { IsInt, IsOptional, Min } from 'class-validator';

export class MarkSeriesReadDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  upToBookId?: number;
}
