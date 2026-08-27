import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';

export interface ManagedUserRecord {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  active: boolean;
  hasExternalIdentity: boolean;
  role: { code: string; name: string; startDate: string };
  assignment: {
    scopeType: string;
    regionId?: string;
    municipalityId?: string;
    facilityId?: string;
    label: string;
    startDate: string;
  };
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class UserAdminApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private get endpoint() {
    return `${this.config.apiUrl}/v1/admin/users`;
  }
  list() {
    return this.http.get<ManagedUserRecord[]>(this.endpoint);
  }
  create(input: {
    fullName: string;
    email: string;
    phone?: string;
    roleCode: string;
    scopeType: string;
    regionId?: string;
    municipalityId?: string;
    facilityId?: string;
    startDate: string;
    reason: string;
  }) {
    return this.http.post<ManagedUserRecord>(this.endpoint, input);
  }
  updateStatus(userId: string, active: boolean, expectedUpdatedAt: string, reason: string) {
    return this.http.patch<ManagedUserRecord>(`${this.endpoint}/${userId}/status`, {
      active,
      expectedUpdatedAt,
      reason,
    });
  }
  changeAccess(
    userId: string,
    input: {
      roleCode: string;
      scopeType: string;
      regionId?: string;
      municipalityId?: string;
      facilityId?: string;
      startDate: string;
      expectedUpdatedAt: string;
      reason: string;
    },
  ) {
    return this.http.post<ManagedUserRecord>(`${this.endpoint}/${userId}/access-changes`, input);
  }
  linkExternalIdentity(
    userId: string,
    input: {
      externalSubject: string;
      activate: boolean;
      expectedUpdatedAt: string;
      reason: string;
    },
  ) {
    return this.http.post<ManagedUserRecord>(`${this.endpoint}/${userId}/external-identity`, input);
  }
  invite(userId: string, input: { activate: boolean; expectedUpdatedAt: string; reason: string }) {
    return this.http.post<ManagedUserRecord>(`${this.endpoint}/${userId}/invitation`, input);
  }
}
