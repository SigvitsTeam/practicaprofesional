import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';

export interface CaptureContextResponse {
  facilities: {
    id: string;
    code: string;
    name: string;
    type: string;
    municipality: { id: string; code: string; name: string };
    region: { id: string; code: string; name: string };
  }[];
  populationTypes: { id: string; code: string; name: string }[];
  classifications: {
    id: string;
    code: string;
    name: string;
    diseases: { id: string; name: string; appliesToMale: boolean; appliesToFemale: boolean }[];
  }[];
}

export interface MonthlyReportingPeriodResponse {
  id: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  status: 'ABIERTO' | 'CERRADO' | 'BLOQUEADO';
}

export interface CreateAttentionRequest {
  facilityId: string;
  attentionDate: string;
  patientRecordNumber: string;
  originText: string;
  sex: 'H' | 'M';
  age: number;
  populationTypeId: string;
  isContact: boolean;
  isPregnant: boolean;
  observation?: string;
  diagnoses: { diseaseId: string; caseType: 'NUEVO' | 'CONTROL' }[];
}

export interface ItsAttentionRecord {
  id: string;
  facilityId: string;
  attentionDate: string;
  patientRecordNumber: string;
  originText: string;
  sex: 'H' | 'M';
  age: number;
  populationType: { id: string; code: string; name: string };
  isContact: boolean;
  isPregnant: boolean;
  possibleDuplicate: boolean;
  observation?: string;
  diagnoses: { diseaseId: string; diseaseName: string; caseType: 'NUEVO' | 'CONTROL' }[];
  createdAt: string;
  updatedAt: string;
}

export interface ItsAttentionPage {
  items: ItsAttentionRecord[];
  nextCursor?: string;
}

export interface ItsMonthlyReportResponse {
  facility: {
    id: string;
    code: string;
    name: string;
    municipalityName: string;
    regionName: string;
  };
  year: number;
  month: number;
  ageGroups: { code: string; name: string; formatOrder: number }[];
  rows: {
    diseaseId: string;
    code?: string;
    diseaseName: string;
    classificationCode: string;
    classificationName: string;
    diagnosis: { newCases: number; controls: number };
    sex: { male: number; female: number };
    ageGroups: Record<string, { male: number; female: number }>;
    population: {
      generalMale: { newCases: number; controls: number };
      generalFemale: { newCases: number; controls: number };
      generalPregnant: { newCases: number; controls: number };
      sexWorkerMale: { newCases: number; controls: number };
      sexWorkerFemale: { newCases: number; controls: number };
      sexWorkerPregnant: { newCases: number; controls: number };
      contacts: { male: number; female: number };
    };
  }[];
  totalAttentions: number;
}

export type Its2WorkflowStatus =
  'BORRADOR' | 'ENVIADO_A_MUNICIPIO' | 'DEVUELTO_POR_MUNICIPIO' | 'APROBADO_MUNICIPIO';
export interface Its2WorkflowReport {
  id: string;
  status: Its2WorkflowStatus;
  version: number;
  facility: { id: string; code: string; name: string };
  municipalityId: string;
  year: number;
  month: number;
  totalAttentions: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15?: number;
  attentions15Plus?: number;
  attentionTotalsSource?: string;
  currentComment?: string;
  generatedAt: string;
  sentAt?: string;
  approvedAt?: string;
  openObservations: { id: string; comment: string; createdAt: string }[];
}

export type MunicipalConsolidationStatus =
  'BORRADOR' | 'ENVIADO_A_REGION' | 'DEVUELTO_POR_REGION' | 'APROBADO_REGION';
export interface MunicipalConsolidationReport {
  id: string;
  status: MunicipalConsolidationStatus;
  version: number;
  municipality: { id: string; code: string; name: string };
  regionId: string;
  year: number;
  month: number;
  expectedFacilities: number;
  sourceReports: {
    id: string;
    version: number;
    facility: { id: string; code: string; name: string };
  }[];
  sourceAttentionCount: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15?: number;
  attentions15Plus?: number;
  currentComment?: string;
  generatedAt: string;
  sentAt?: string;
  approvedAt?: string;
  openObservations: { id: string; comment: string; createdAt: string }[];
}
export interface MunicipalConsolidationContext {
  municipalities: {
    id: string;
    code: string;
    name: string;
    regionId: string;
    activeFacilities: number;
  }[];
}
export type RegionalConsolidationStatus =
  'BORRADOR' | 'ENVIADO_A_CENTRAL' | 'DEVUELTO_POR_CENTRAL' | 'APROBADO_CENTRAL';
export interface RegionalConsolidationReport {
  id: string;
  status: RegionalConsolidationStatus;
  version: number;
  region: { id: string; code: string; name: string };
  year: number;
  month: number;
  expectedMunicipalities: number;
  sourceReports: {
    id: string;
    version: number;
    municipality: { id: string; code: string; name: string };
  }[];
  sourceAttentionCount: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15?: number;
  attentions15Plus?: number;
  currentComment?: string;
  generatedAt: string;
  sentAt?: string;
  approvedAt?: string;
  openObservations: { id: string; comment: string; createdAt: string }[];
}
export interface RegionalConsolidationContext {
  regions: { id: string; code: string; name: string; activeMunicipalities: number }[];
}
export type NationalConsolidationStatus =
  'BORRADOR' | 'CONSOLIDADO_NACIONAL' | 'CERRADO_OFICIAL' | 'REABIERTO_AUTORIZADO';
export interface NationalConsolidationReport {
  id: string;
  status: NationalConsolidationStatus;
  version: number;
  year: number;
  month: number;
  periodStatus: 'ABIERTO' | 'CERRADO' | 'BLOQUEADO';
  expectedRegions: number;
  sourceReports: {
    id: string;
    version: number;
    region: { id: string; code: string; name: string };
  }[];
  sourceAttentionCount: number;
  attentionTotalsComplete: boolean;
  attentionsUnder15?: number;
  attentions15Plus?: number;
  currentComment?: string;
  generatedAt: string;
  closedAt?: string;
}
export interface NationalConsolidationContext {
  activeRegions: number;
}
export type TerritorialAnalyticsLevel = 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';
export interface TerritorialAnalyticsResponse {
  level: TerritorialAnalyticsLevel;
  year: number;
  month: number;
  rows: {
    id: string;
    code: string;
    name: string;
    reportId?: string;
    reportVersion?: number;
    status: string;
    attentions: number;
    newCases: number;
    controls: number;
    alerts: number;
    sentAt?: string;
    latitude?: number;
    longitude?: number;
    coordinatesValidated?: boolean;
  }[];
}

@Injectable({ providedIn: 'root' })
export class ItsCaptureApiService {
  private readonly http = inject(HttpClient);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private get endpoint() {
    return `${this.runtimeConfig.apiUrl}/v1/its1/attentions`;
  }
  private get reportsEndpoint() {
    return `${this.runtimeConfig.apiUrl}/v1/its2/reports`;
  }

  getContext() {
    return this.http.get<CaptureContextResponse>(`${this.endpoint}/context`);
  }
  getMonthlyReportingPeriods() {
    return this.http.get<MonthlyReportingPeriodResponse[]>(
      `${this.runtimeConfig.apiUrl}/v1/reporting-periods/monthly`,
    );
  }
  createAttention(input: CreateAttentionRequest) {
    return this.http.post<{ id: string; possibleDuplicate: boolean }>(this.endpoint, input);
  }
  listAttentions(facilityId: string, year: number, month: number, limit = 25, cursor?: string) {
    return this.http.get<ItsAttentionPage>(this.endpoint, {
      params: { facilityId, year, month, limit, ...(cursor ? { cursor } : {}) },
    });
  }
  updateAttention(input: CreateAttentionRequest & { id: string; expectedUpdatedAt: string }) {
    const { id, ...body } = input;
    return this.http.patch<ItsAttentionRecord>(`${this.endpoint}/${id}`, body);
  }
  cancelAttention(id: string, facilityId: string, expectedUpdatedAt: string, reason: string) {
    return this.http.patch<{ id: string; status: 'ANULADO'; updatedAt: string }>(
      `${this.endpoint}/${id}/cancel`,
      { facilityId, expectedUpdatedAt, reason },
    );
  }
  getMonthlyReport(facilityId: string, year: number, month: number) {
    return this.http.get<ItsMonthlyReportResponse>(`${this.endpoint}/monthly-report`, {
      params: { facilityId, year, month },
    });
  }
  downloadMonthlyReportPdf(facilityId: string, year: number, month: number) {
    return this.http.get(`${this.endpoint}/monthly-report.pdf`, {
      params: { facilityId, year, month },
      responseType: 'blob',
    });
  }
  downloadIts1RegisterPdf(facilityId: string, year: number, month: number) {
    return this.http.get(`${this.endpoint}/register.pdf`, {
      params: { facilityId, year, month },
      responseType: 'blob',
    });
  }
  getCurrentIts2Report(facilityId: string, year: number, month: number) {
    return this.http.get<Its2WorkflowReport | null>(`${this.reportsEndpoint}/current`, {
      params: { facilityId, year, month },
    });
  }
  prepareIts2Report(input: {
    facilityId: string;
    year: number;
    month: number;
    attentionsUnder15?: number;
    attentions15Plus?: number;
    attentionTotalsSource?: string;
  }) {
    return this.http.post<Its2WorkflowReport>(`${this.reportsEndpoint}/prepare`, input);
  }
  submitIts2Report(reportId: string) {
    return this.http.post<Its2WorkflowReport>(`${this.reportsEndpoint}/${reportId}/submit`, {});
  }
  getMunicipalIts2Inbox(year: number, month: number) {
    return this.http.get<Its2WorkflowReport[]>(`${this.reportsEndpoint}/municipal-inbox`, {
      params: { year, month },
    });
  }
  returnIts2Report(reportId: string, comment: string) {
    return this.http.post<Its2WorkflowReport>(`${this.reportsEndpoint}/${reportId}/return`, {
      comment,
    });
  }
  approveIts2Report(reportId: string, comment?: string) {
    return this.http.post<Its2WorkflowReport>(`${this.reportsEndpoint}/${reportId}/approve`, {
      comment,
    });
  }
  getCurrentMunicipalConsolidation(municipalityId: string, year: number, month: number) {
    return this.http.get<MunicipalConsolidationReport | null>(
      `${this.runtimeConfig.apiUrl}/v1/its2/municipal-consolidations/current`,
      { params: { municipalityId, year, month } },
    );
  }
  getMunicipalConsolidationContext() {
    return this.http.get<MunicipalConsolidationContext>(
      `${this.runtimeConfig.apiUrl}/v1/its2/municipal-consolidations/context`,
    );
  }
  prepareMunicipalConsolidation(
    municipalityId: string,
    year: number,
    month: number,
    comment?: string,
  ) {
    return this.http.post<MunicipalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/municipal-consolidations/prepare`,
      { municipalityId, year, month, comment },
    );
  }
  submitMunicipalConsolidation(reportId: string, comment?: string) {
    return this.http.post<MunicipalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/municipal-consolidations/${reportId}/submit-region`,
      { comment },
    );
  }
  getRegionalConsolidationInbox(year: number, month: number) {
    return this.http.get<MunicipalConsolidationReport[]>(
      `${this.runtimeConfig.apiUrl}/v1/its2/municipal-consolidations/regional-inbox`,
      { params: { year, month } },
    );
  }
  returnMunicipalConsolidation(reportId: string, comment: string) {
    return this.http.post<MunicipalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/municipal-consolidations/${reportId}/return-municipality`,
      { comment },
    );
  }
  approveMunicipalConsolidation(reportId: string, comment?: string) {
    return this.http.post<MunicipalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/municipal-consolidations/${reportId}/approve-region`,
      { comment },
    );
  }
  getRegionalConsolidationContext() {
    return this.http.get<RegionalConsolidationContext>(
      `${this.runtimeConfig.apiUrl}/v1/its2/regional-consolidations/context`,
    );
  }
  getCurrentRegionalConsolidation(regionId: string, year: number, month: number) {
    return this.http.get<RegionalConsolidationReport | null>(
      `${this.runtimeConfig.apiUrl}/v1/its2/regional-consolidations/current`,
      { params: { regionId, year, month } },
    );
  }
  prepareRegionalConsolidation(regionId: string, year: number, month: number, comment?: string) {
    return this.http.post<RegionalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/regional-consolidations/prepare`,
      { regionId, year, month, comment },
    );
  }
  submitRegionalConsolidation(reportId: string, comment?: string) {
    return this.http.post<RegionalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/regional-consolidations/${reportId}/submit-central`,
      { comment },
    );
  }
  getCentralConsolidationInbox(year: number, month: number) {
    return this.http.get<RegionalConsolidationReport[]>(
      `${this.runtimeConfig.apiUrl}/v1/its2/regional-consolidations/central-inbox`,
      { params: { year, month } },
    );
  }
  returnRegionalConsolidation(reportId: string, comment: string) {
    return this.http.post<RegionalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/regional-consolidations/${reportId}/return-region`,
      { comment },
    );
  }
  approveRegionalConsolidation(reportId: string, comment?: string) {
    return this.http.post<RegionalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/regional-consolidations/${reportId}/approve-central`,
      { comment },
    );
  }
  getNationalConsolidationContext() {
    return this.http.get<NationalConsolidationContext>(
      `${this.runtimeConfig.apiUrl}/v1/its2/national-consolidations/context`,
    );
  }
  getCurrentNationalConsolidation(year: number, month: number) {
    return this.http.get<NationalConsolidationReport | null>(
      `${this.runtimeConfig.apiUrl}/v1/its2/national-consolidations/current`,
      { params: { year, month } },
    );
  }
  prepareNationalConsolidation(year: number, month: number, comment?: string) {
    return this.http.post<NationalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/national-consolidations/prepare`,
      { year, month, comment },
    );
  }
  finalizeNationalConsolidation(reportId: string, comment?: string) {
    return this.http.post<NationalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/national-consolidations/${reportId}/finalize`,
      { comment },
    );
  }
  closeNationalConsolidation(reportId: string, reason: string) {
    return this.http.post<NationalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/national-consolidations/${reportId}/close`,
      { reason },
    );
  }
  reopenNationalConsolidation(reportId: string, reason: string) {
    return this.http.post<NationalConsolidationReport>(
      `${this.runtimeConfig.apiUrl}/v1/its2/national-consolidations/${reportId}/reopen`,
      { reason },
    );
  }
  getTerritorialAnalytics(level: TerritorialAnalyticsLevel, year: number, month: number) {
    return this.http.get<TerritorialAnalyticsResponse>(
      `${this.runtimeConfig.apiUrl}/v1/analytics/territorial`,
      { params: { level, year, month } },
    );
  }
}
