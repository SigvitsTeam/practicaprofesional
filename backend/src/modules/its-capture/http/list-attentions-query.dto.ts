import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListAttentionsQueryDto {
  @IsUUID() facilityId!: string;
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) year!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) month!: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsString() cursor?: string;
}
