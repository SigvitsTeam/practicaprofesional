export type ReportingPeriodStatus = 'ABIERTO' | 'CERRADO' | 'BLOQUEADO';

export interface MonthlyReportingPeriod {
  id: string;
  year: number;
  month: number;
  startDate: Date;
  endDate: Date;
  status: ReportingPeriodStatus;
}
