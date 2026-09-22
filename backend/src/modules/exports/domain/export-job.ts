export type ExportFormat = 'XLSX' | 'PDF';
export type ExportScopeLevel = 'NACIONAL' | 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';
export type ExportJobStatus = 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'FALLIDO';

export type AnnualComparisonIndicator =
  'TOTAL_CASES' | 'NEW_CASES' | 'CONTROLS' | 'RATE_PER_1000' | 'ALERTS';

export type MunicipalExportTimeUnit = 'MONTH' | 'EPIDEMIOLOGICAL_WEEK';

export interface MunicipalConsolidatedExportParameters extends Record<string, unknown> {
  timeUnit: MunicipalExportTimeUnit;
  startPeriod: string;
  endPeriod: string;
}

export interface ResolvedMunicipalExportRange {
  parameters: MunicipalConsolidatedExportParameters;
  startDate: Date;
  endDate: Date;
  anchorYear: number;
  anchorMonth: number;
  periodLabel: string;
  yearLabel: string;
  filenameLabel: string;
  epidemiologicalWeekIds?: readonly string[];
}

export interface AnnualComparisonParameters extends Record<string, unknown> {
  dimension: 'periods' | 'indicators';
  rangeAStart: string;
  rangeAEnd: string;
  rangeBStart: string;
  rangeBEnd: string;
  indicatorA: AnnualComparisonIndicator;
  indicatorB: AnnualComparisonIndicator;
}

export interface ExportJob {
  id: string;
  reportType: string;
  format: ExportFormat;
  scopeLevel: ExportScopeLevel;
  territoryId: string | null;
  year: number;
  month: number;
  parameters: Record<string, unknown> | null;
  status: ExportJobStatus;
  attempts: number;
  outputAvailable: boolean;
  outputExpiresAt: Date | null;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExportJobInput {
  requestedByUserId: string;
  idempotencyKey: string;
  reportType: string;
  format: ExportFormat;
  scopeLevel: ExportScopeLevel;
  territoryId: string | null;
  year: number;
  month: number;
  parameters?: Record<string, unknown> | null;
  requestId: string;
}

export type CreateExportJobCommand = Omit<
  CreateExportJobInput,
  'requestedByUserId' | 'year' | 'month'
> & {
  year?: number;
  month?: number;
};

export interface ClaimedExportJob extends ExportJob {
  requestedByUserId: string;
  maxAttempts: number;
}

// claimNext increments attempts atomically; an older claim must never mutate a newer attempt.
export type ExportJobClaim = Readonly<Pick<ClaimedExportJob, 'id' | 'attempts'>>;

export class InvalidExportJobError extends Error {}
export class ExportJobScopeError extends Error {}
export class ExportJobConflictError extends Error {}
export class ExportArtifactNotFoundError extends Error {}
export class ExportArtifactExpiredError extends Error {}
export class ExportArtifactAccessError extends Error {}

export interface ExportArtifactDownload {
  storageKey: string;
  format: ExportFormat;
  filename: string;
  reportType: string;
  scopeLevel: ExportScopeLevel;
  territoryId: string | null;
}
