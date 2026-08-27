import { Controller, Get } from '@nestjs/common';
import { DataLevel } from '../../authorization/domain/authorization.types';
import { RequireAccess } from '../../authorization/http/require-access.decorator';
import { GetReportingPeriodsUseCase } from '../application/get-reporting-periods.use-case';
import type { MonthlyReportingPeriod } from '../domain/reporting-period';

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
}
