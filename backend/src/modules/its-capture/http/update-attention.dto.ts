import { IsDateString } from 'class-validator';
import { CreateAttentionDto } from './create-attention.dto';

export class UpdateAttentionDto extends CreateAttentionDto {
  @IsDateString({ strict: true }) expectedUpdatedAt!: string;
}
