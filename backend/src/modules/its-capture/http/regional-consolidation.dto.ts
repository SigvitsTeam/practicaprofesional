import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class RegionalConsolidationPeriodDto {
  @IsUUID() regionId!: string;
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
}

export class PrepareRegionalConsolidationDto extends RegionalConsolidationPeriodDto {
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class RegionalTransitionDto {
  @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}
