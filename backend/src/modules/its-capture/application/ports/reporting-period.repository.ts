import type {
  EpidemiologicalWeekPeriod,
  MonthlyReportingPeriod,
} from '../../domain/reporting-period';

export abstract class ReportingPeriodRepository {
  abstract listMonthly(limit: number): Promise<readonly MonthlyReportingPeriod[]>;
  abstract listEpidemiologicalWeeks(
    startYear: number,
    endYear: number,
  ): Promise<readonly EpidemiologicalWeekPeriod[]>;
}
