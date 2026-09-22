import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class EpidemiologicalWeekRangeQueryDto {
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) startYear!: number;
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) endYear!: number;
}
