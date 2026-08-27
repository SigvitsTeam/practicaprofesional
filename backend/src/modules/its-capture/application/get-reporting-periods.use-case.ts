import { Injectable } from '@nestjs/common';
import { ReportingPeriodRepository } from './ports/reporting-period.repository';
import type { MonthlyReportingPeriod } from '../domain/reporting-period';

@Injectable()
export class GetReportingPeriodsUseCase {
  constructor(private readonly repository: ReportingPeriodRepository) {}

  execute(limit = 24): Promise<readonly MonthlyReportingPeriod[]> {
    return this.repository.listMonthly(Math.min(Math.max(limit, 1), 60));
  }
}
