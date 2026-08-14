import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class Its2ReportPeriodQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

export class CurrentIts2ReportQueryDto extends Its2ReportPeriodQueryDto {
  @IsUUID()
  facilityId!: string;
}

export class PrepareIts2ReportDto extends CurrentIts2ReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  attentionsUnder15?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  attentions15Plus?: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  attentionTotalsSource?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ReturnIts2ReportDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  comment!: string;
}

export class ApproveIts2ReportDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
