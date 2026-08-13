import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export interface CaptureContextResponse {
  facilities: { id: string; code: string; name: string; type: string }[];
  populationTypes: { id: string; code: string; name: string }[];
  classifications: {
    id: string; code: string; name: string;
    diseases: { id: string; name: string; appliesToMale: boolean; appliesToFemale: boolean }[];
  }[];
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

export interface ItsMonthlyReportResponse {
  facility: { id: string; code: string; name: string; municipalityName: string; regionName: string };
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

@Injectable({ providedIn: 'root' })
export class ItsCaptureApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/v1/its1/attentions`;

  getContext() { return this.http.get<CaptureContextResponse>(`${this.endpoint}/context`); }
  createAttention(input: CreateAttentionRequest) { return this.http.post<{ id: string; possibleDuplicate: boolean }>(this.endpoint, input); }
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
}
