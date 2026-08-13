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

@Injectable({ providedIn: 'root' })
export class ItsCaptureApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${environment.apiUrl}/v1/its1/attentions`;

  getContext() { return this.http.get<CaptureContextResponse>(`${this.endpoint}/context`); }
  createAttention(input: CreateAttentionRequest) { return this.http.post<{ id: string; possibleDuplicate: boolean }>(this.endpoint, input); }
}
