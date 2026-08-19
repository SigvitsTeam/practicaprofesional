import { Injectable } from '@nestjs/common';
import {
  InvalidAttentionError,
  type CancelledAttention,
  type CancelAttentionInput,
} from '../domain/its-attention';
import { ItsAttentionRepository } from './ports/its-attention.repository';

@Injectable()
export class CancelAttentionUseCase {
  constructor(private readonly repository: ItsAttentionRepository) {}

  execute(input: CancelAttentionInput): Promise<CancelledAttention> {
    const reason = input.reason.trim().replace(/\s+/g, ' ');
    if (reason.length < 10 || reason.length > 500)
      throw new InvalidAttentionError('El motivo debe contener entre 10 y 500 caracteres.');
    if (Number.isNaN(input.expectedUpdatedAt.getTime()))
      throw new InvalidAttentionError('La versión del registro no es válida.');
    return this.repository.cancel({ ...input, reason });
  }
}
