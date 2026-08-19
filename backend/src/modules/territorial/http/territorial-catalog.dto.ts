import { IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateMunicipalityDto {
  @IsUUID() regionId!: string;
  @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/) officialCode!: string;
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}

export class CreateFacilityDto {
  @IsUUID() municipalityId!: string;
  @IsString() @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/) code!: string;
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsString() @MinLength(2) @MaxLength(50) type!: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}
