import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';

export interface ExportJobRecord {
  id: string;
  reportType: string;
  format: 'XLSX' | 'PDF';
  scopeLevel: string;
  territoryId?: string;
  year: number;
  month: number;
  parameters?: Record<string, unknown> | null;
  status: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'FALLIDO';
  attempts: number;
  outputAvailable: boolean;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export type MunicipalExportRange =
  | {
      timeUnit: 'MONTH';
      startPeriod: string;
      endPeriod: string;
    }
  | {
      timeUnit: 'EPIDEMIOLOGICAL_WEEK';
      startPeriod: string;
      endPeriod: string;
    };

interface ExportJobRequestBase {
  idempotencyKey: string;
  format: 'XLSX' | 'PDF';
  scopeLevel: string;
  territoryId?: string;
}

export type CreateExportJobRequest =
  | (ExportJobRequestBase & {
      reportType: 'MUNICIPAL_CONSOLIDATED';
      parameters: MunicipalExportRange;
      year?: never;
      month?: never;
    })
  | (ExportJobRequestBase & {
      reportType: string;
      year: number;
      month: number;
      parameters?: Record<string, unknown>;
    });

@Injectable({ providedIn: 'root' })
export class ExportJobsApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private get endpoint() {
    return `${this.config.apiUrl}/v1/exports/jobs`;
  }
  list() {
    return this.http.get<ExportJobRecord[]>(this.endpoint);
  }
  create(input: CreateExportJobRequest) {
    return this.http.post<ExportJobRecord>(this.endpoint, input);
  }
  createIts1(input: {
    idempotencyKey: string;
    format: 'XLSX' | 'PDF';
    facilityId: string;
    year: number;
    month: number;
  }) {
    return this.http.post<ExportJobRecord>(`${this.endpoint}/its1`, input);
  }
  download(jobId: string) {
    return this.http.get(`${this.endpoint}/${jobId}/download`, { responseType: 'blob' });
  }
}
