export type ExportFormat = 'XLSX' | 'PDF';
export type ExportScopeLevel = 'NACIONAL' | 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';
export type ExportJobStatus = 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'FALLIDO';

export interface ExportJob {
  id: string;
  reportType: string;
  format: ExportFormat;
  scopeLevel: ExportScopeLevel;
  territoryId: string | null;
  year: number;
  month: number;
  status: ExportJobStatus;
  attempts: number;
  outputAvailable: boolean;
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
  requestId: string;
}

export class InvalidExportJobError extends Error {}
export class ExportJobScopeError extends Error {}
export class ExportJobConflictError extends Error {}
