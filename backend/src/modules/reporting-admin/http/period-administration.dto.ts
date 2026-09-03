import { Type } from 'class-transformer';
import {
  Equals,
  IsInt,
  IsISO8601,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CalendarQueryDto {
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year!: number;
}
export class PeriodCommandDto {
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
  @Equals(true) confirmNationalScope!: boolean;
}
export class CreateCalendarDto extends PeriodCommandDto {
  @IsInt() @Min(2020) @Max(2100) year!: number;
}
export class OpenPeriodDto extends PeriodCommandDto {
  @IsISO8601({ strict: true }) expectedUpdatedAt!: string;
}

export class PeriodVersionDto {
  @IsUUID() id!: string;
  @IsISO8601({ strict: true }) updatedAt!: string;
}

export class OpenYearDto extends CreateCalendarDto {
  @IsArray()
  @ArrayMinSize(12)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PeriodVersionDto)
  expectedPeriods!: PeriodVersionDto[];
}
