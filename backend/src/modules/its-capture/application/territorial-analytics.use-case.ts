import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import {
  InvalidTerritorialAnalyticsQueryError,
  type TerritorialAnalyticsLevel,
  type TerritorialAnalyticsResult,
} from '../domain/territorial-analytics';
import { TerritorialAnalyticsRepository } from './ports/territorial-analytics.repository';

@Injectable()
export class TerritorialAnalyticsUseCase {
  constructor(private readonly repository: TerritorialAnalyticsRepository) {}

  async execute(
    input: { level: TerritorialAnalyticsLevel; year: number; month: number },
    subject: AuthorizationSubject,
  ): Promise<TerritorialAnalyticsResult> {
    if (!Number.isInteger(input.year) || input.year < 2020 || input.year > 2100)
      throw new InvalidTerritorialAnalyticsQueryError('El año solicitado no es válido.');
    if (!Number.isInteger(input.month) || input.month < 1 || input.month > 12)
      throw new InvalidTerritorialAnalyticsQueryError('El mes solicitado no es válido.');
    if (input.level === 'REGION' && !subject.territory.national)
      throw new InvalidTerritorialAnalyticsQueryError(
        'El nivel regional agregado requiere alcance nacional.',
      );
    const rows = await this.repository.list({
      ...input,
      scope: subject.territory,
    });
    return { ...input, rows };
  }
}
