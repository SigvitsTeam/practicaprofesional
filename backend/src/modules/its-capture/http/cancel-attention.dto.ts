import { IsISO8601, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CancelAttentionDto {
  @IsUUID('4') facilityId!: string;
  @IsISO8601() expectedUpdatedAt!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}
