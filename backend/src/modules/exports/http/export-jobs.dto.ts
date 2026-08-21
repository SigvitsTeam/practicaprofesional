import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';

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
  @IsString() @Matches(/^[A-Z][A-Z0-9_]{2,79}$/) reportType!: string;
  @IsEnum(ExportFormatDto) format!: ExportFormatDto;
  @IsEnum(ExportScopeLevelDto) scopeLevel!: ExportScopeLevelDto;
  @IsOptional() @IsUUID() territoryId?: string;
  @IsInt() @Min(2000) @Max(2100) year!: number;
  @IsInt() @Min(1) @Max(12) month!: number;
}
