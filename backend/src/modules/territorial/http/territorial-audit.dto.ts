import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class TerritorialAuditQueryDto {
  @IsOptional() @IsUUID() municipalityId?: string;
  @IsOptional() @IsUUID() networkId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() cursor?: string;
}
