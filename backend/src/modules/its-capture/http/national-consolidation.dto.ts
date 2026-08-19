import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class NationalPeriodDto {
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
}
export class PrepareNationalDto extends NationalPeriodDto {
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
export class NationalTransitionDto {
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
export class NationalReasonDto {
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}
