import { IsInt, Min } from 'class-validator';

export class MarkSeriesUnreadDto {
  @IsInt()
  @Min(1)
  fromBookId!: number;
}
