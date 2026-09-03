import type {
  AnnualOpeningResult,
  ManagedPeriod,
  PeriodAudit,
  PeriodChangeContext,
  PeriodVersion,
} from '../domain/calendar';

export abstract class PeriodAdministrationRepository {
  abstract list(year: number): Promise<ManagedPeriod[]>;
  abstract createCalendar(
    year: number,
    context: PeriodChangeContext,
  ): Promise<{ createdMonths: number; createdWeeks: number }>;
  abstract open(
    id: string,
    expectedUpdatedAt: Date,
    context: PeriodChangeContext,
  ): Promise<ManagedPeriod>;
  abstract history(id: string): Promise<PeriodAudit[]>;
  abstract openYear(
    year: number,
    expectedPeriods: PeriodVersion[],
    context: PeriodChangeContext,
  ): Promise<AnnualOpeningResult>;
}
