export type ReportingPeriodStatus = 'ABIERTO' | 'CERRADO' | 'BLOQUEADO';

export interface MonthlyReportingPeriod {
  id: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: ReportingPeriodStatus;
}

export interface EpidemiologicalWeekPeriod {
  id: string;
  year: number;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  active: boolean;
  label: string;
}

export class InvalidReportingPeriodRangeError extends Error {}
