import { Injectable } from '@nestjs/common';
import { ReportingPeriodRepository } from './ports/reporting-period.repository';
import type { MonthlyReportingPeriod } from '../domain/reporting-period';
import {
  InvalidReportingPeriodRangeError,
  type EpidemiologicalWeekPeriod,
} from '../domain/reporting-period';

@Injectable()
export class GetReportingPeriodsUseCase {
  constructor(private readonly repository: ReportingPeriodRepository) {}

  execute(limit = 24): Promise<readonly MonthlyReportingPeriod[]> {
    return this.repository.listMonthly(Math.min(Math.max(limit, 1), 60));
  }

  epidemiologicalWeeks(
    startYear: number,
    endYear: number,
  ): Promise<readonly EpidemiologicalWeekPeriod[]> {
    if (
      !Number.isInteger(startYear) ||
      !Number.isInteger(endYear) ||
      startYear < 2020 ||
      endYear > 2100 ||
      startYear > endYear ||
      endYear - startYear + 1 > 5
    )
      throw new InvalidReportingPeriodRangeError(
        'El rango de años debe estar ordenado y abarcar como máximo cinco años.',
      );
    return this.repository.listEpidemiologicalWeeks(startYear, endYear);
  }
}
