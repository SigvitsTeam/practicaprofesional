import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { DataLevel } from '../../authorization/domain/authorization.types';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { GetReportingPeriodsUseCase } from '../application/get-reporting-periods.use-case';
import type { MonthlyReportingPeriod } from '../domain/reporting-period';
import {
  InvalidReportingPeriodRangeError,
  type EpidemiologicalWeekPeriod,
} from '../domain/reporting-period';
import { EpidemiologicalWeekRangeQueryDto } from './reporting-periods.dto';

@Controller('reporting-periods')
export class ReportingPeriodsController {
  constructor(private readonly getReportingPeriods: GetReportingPeriodsUseCase) {}

  @Get('monthly')
  @RequireAccess({
    permission: 'reporting:periods:read',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  listMonthly(): Promise<readonly MonthlyReportingPeriod[]> {
    return this.getReportingPeriods.execute();
  }

  @Get('epidemiological-weeks')
  @RequireAccess({
    permission: 'reporting:periods:read',
    dataLevel: DataLevel.Configuration,
    scope: 'OWN',
  })
  listEpidemiologicalWeeks(
    @Query() query: EpidemiologicalWeekRangeQueryDto,
  ): Promise<readonly EpidemiologicalWeekPeriod[]> {
    try {
      return this.getReportingPeriods.epidemiologicalWeeks(query.startYear, query.endYear);
    } catch (error: unknown) {
      if (error instanceof InvalidReportingPeriodRangeError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
