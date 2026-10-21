import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class TerritorialAuditQueryDto {
  @IsOptional() @IsIn(['NACIONAL', 'REGION', 'ESTABLECIMIENTO']) entityType?:
    'NACIONAL' | 'REGION' | 'ESTABLECIMIENTO';
  @IsOptional() @IsUUID() entityId?: string;
  @IsOptional() @IsUUID() municipalityId?: string;
  @IsOptional() @IsUUID() networkId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsUUID() cursor?: string;
}
