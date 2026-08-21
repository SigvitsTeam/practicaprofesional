import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export enum ExportFormatDto {
  Xlsx = 'XLSX',
  Pdf = 'PDF',
}
export enum ExportScopeLevelDto {
  National = 'NACIONAL',
  Region = 'REGION',
  Municipality = 'MUNICIPIO',
  Facility = 'ESTABLECIMIENTO',
}

export class CreateExportJobDto {
  @IsUUID() idempotencyKey!: string;
  @IsString()
  @IsIn([
    'TERRITORIAL_SUMMARY',
    'ITS2_MONTHLY',
    'MUNICIPAL_CONSOLIDATED',
    'REGIONAL_CONSOLIDATED',
    'NATIONAL_CONSOLIDATED',
  ])
  reportType!: string;
  @IsEnum(ExportFormatDto) format!: ExportFormatDto;
  @IsEnum(ExportScopeLevelDto) scopeLevel!: ExportScopeLevelDto;
  @IsOptional() @IsUUID() territoryId?: string;
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsInt() @Min(1) @Max(12) month!: number;
}

export class CreateIts1ExportJobDto {
  @IsUUID() idempotencyKey!: string;
  @IsEnum(ExportFormatDto) format!: ExportFormatDto;
  @IsUUID() facilityId!: string;
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsInt() @Min(1) @Max(12) month!: number;
}
