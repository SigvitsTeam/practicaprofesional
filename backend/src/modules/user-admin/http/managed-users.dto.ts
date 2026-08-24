import {
  IsDateString,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsISO8601,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { RoleCode } from '../../authorization/domain/authorization.types';

export enum TerritorialScopeDto {
  National = 'NACIONAL',
  Region = 'REGION',
  Municipality = 'MUNICIPIO',
  Facility = 'ESTABLECIMIENTO',
}

export class UpdateManagedUserStatusDto {
  @IsBoolean() active!: boolean;
  @IsISO8601() expectedUpdatedAt!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}

export class ChangeManagedUserAccessDto {
  @IsEnum(RoleCode) roleCode!: RoleCode;
  @IsEnum(TerritorialScopeDto) scopeType!: TerritorialScopeDto;
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsUUID() municipalityId?: string;
  @IsOptional() @IsUUID() facilityId?: string;
  @IsDateString({ strict: true }) startDate!: string;
  @IsISO8601() expectedUpdatedAt!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}

export class CreateManagedUserDto {
  @IsString() @MinLength(3) @MaxLength(160) fullName!: string;
  @IsEmail() @MaxLength(255) email!: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsEnum(RoleCode) roleCode!: RoleCode;
  @IsEnum(TerritorialScopeDto) scopeType!: TerritorialScopeDto;
  @IsOptional() @IsUUID() regionId?: string;
  @IsOptional() @IsUUID() municipalityId?: string;
  @IsOptional() @IsUUID() facilityId?: string;
  @IsDateString({ strict: true }) startDate!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}

export class LinkExternalIdentityDto {
  @IsString() @MinLength(1) @MaxLength(255) externalSubject!: string;
  @IsBoolean() activate!: boolean;
  @IsISO8601() expectedUpdatedAt!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}

export class InviteManagedUserDto {
  @IsBoolean() activate!: boolean;
  @IsISO8601() expectedUpdatedAt!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}
