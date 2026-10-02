import { ArrayNotEmpty, ArrayUnique, IsArray, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class MergeBooksDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  sourceBookIds!: number[];
}
