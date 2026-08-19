import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  DataLevel,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import { CurrentSubject } from '../../authorization/http/current-subject.decorator';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { TerritorialAnalyticsUseCase } from '../application/territorial-analytics.use-case';
import {
  InvalidTerritorialAnalyticsQueryError,
  type TerritorialAnalyticsResult,
} from '../domain/territorial-analytics';
import { TerritorialAnalyticsQueryDto } from './territorial-analytics.dto';

@Controller('analytics/territorial')
export class TerritorialAnalyticsController {
  constructor(private readonly analytics: TerritorialAnalyticsUseCase) {}

  @Get()
  @RequireAccess({
    permission: 'analytics:territorial:read',
    dataLevel: DataLevel.Aggregated,
    scope: 'OWN',
  })
  async list(
    @Query() query: TerritorialAnalyticsQueryDto,
    @CurrentSubject() subject: AuthorizationSubject,
  ): Promise<TerritorialAnalyticsResult> {
    try {
      return await this.analytics.execute(query, subject);
    } catch (error: unknown) {
      if (error instanceof InvalidTerritorialAnalyticsQueryError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
