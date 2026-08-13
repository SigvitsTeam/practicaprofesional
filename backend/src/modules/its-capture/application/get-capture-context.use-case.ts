import { Injectable } from '@nestjs/common';
import type { CaptureContext } from '../domain/its-attention';
import { ItsAttentionRepository } from './ports/its-attention.repository';

@Injectable()
export class GetCaptureContextUseCase {
  constructor(private readonly repository: ItsAttentionRepository) {}

  execute(facilityIds: readonly string[]): Promise<CaptureContext> {
    return this.repository.getCaptureContext([...new Set(facilityIds)]);
  }
}
