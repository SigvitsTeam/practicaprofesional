import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { RegionType } from '../domain/region';

export class CreateRegionDto {
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/)
  code!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  regionNumber?: string;

  @IsEnum(RegionType)
  type!: RegionType;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
