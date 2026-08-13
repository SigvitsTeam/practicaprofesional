import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum AttentionSexDto {
  H = 'H',
  M = 'M',
}
export enum CaseTypeDto {
  NUEVO = 'NUEVO',
  CONTROL = 'CONTROL',
}

export class AttentionDiagnosisDto {
  @IsUUID() diseaseId!: string;
  @IsEnum(CaseTypeDto) caseType!: CaseTypeDto;
}

export class CreateAttentionDto {
  @IsUUID() facilityId!: string;
  @IsDateString({ strict: true }) attentionDate!: string;
  @IsString() @MinLength(4) @MaxLength(100) patientRecordNumber!: string;
  @IsString() @MinLength(3) @MaxLength(500) originText!: string;
  @IsEnum(AttentionSexDto) sex!: AttentionSexDto;
  @IsInt() @Min(0) @Max(120) age!: number;
  @IsUUID() populationTypeId!: string;
  @IsBoolean() isContact!: boolean;
  @IsBoolean() isPregnant!: boolean;
  @IsOptional() @IsString() @MaxLength(1000) observation?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AttentionDiagnosisDto)
  diagnoses!: AttentionDiagnosisDto[];
}
