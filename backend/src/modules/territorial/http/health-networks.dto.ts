import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { OperationalStatus } from '../domain/region';

export class ListHealthNetworksDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  asOf?: string;
}

export class CreateHealthNetworkDto {
  @IsUUID() regionId!: string;
  @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/) code!: string;
  @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsEnum(OperationalStatus) operationalStatus!: OperationalStatus;
  @IsDateString({ strict: true }) startDate!: string;
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) municipalityIds!: string[];
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}

export class ReplaceNetworkMunicipalitiesDto {
  @IsArray() @ArrayUnique() @IsUUID('4', { each: true }) municipalityIds!: string[];
  @IsDateString({ strict: true }) effectiveDate!: string;
  @IsISO8601() expectedUpdatedAt!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}

export class UpdateHealthNetworkStatusDto {
  @IsEnum(OperationalStatus) status!: OperationalStatus;
  @IsISO8601() expectedUpdatedAt!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}
