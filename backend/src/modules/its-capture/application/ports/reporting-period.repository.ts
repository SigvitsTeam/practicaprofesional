import type { MonthlyReportingPeriod } from '../../domain/reporting-period';

export abstract class ReportingPeriodRepository {
  abstract listMonthly(limit: number): Promise<readonly MonthlyReportingPeriod[]>;
}
