import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type { TerritorialAnalyticsLevel } from '../domain/territorial-analytics';

enum TerritorialAnalyticsLevelDto {
  Region = 'REGION',
  Municipality = 'MUNICIPIO',
  Facility = 'ESTABLECIMIENTO',
}

export class TerritorialAnalyticsQueryDto {
  @IsEnum(TerritorialAnalyticsLevelDto) level!: TerritorialAnalyticsLevel;
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsUUID() municipalityId?: string;
}
