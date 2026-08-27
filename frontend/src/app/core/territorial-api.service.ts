import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';

export interface RegionRecord {
  id: string;
  code: string;
  name: string;
  regionNumber?: string;
  type: string;
  operationalStatus: string;
  active: boolean;
  updatedAt: string;
}
export interface MunicipalityRecord {
  id: string;
  regionId: string;
  regionName: string;
  officialCode: string;
  name: string;
  operationalStatus: string;
  mapValidated: boolean;
  active: boolean;
  facilityCount: number;
  updatedAt: string;
}
export interface FacilityRecord {
  id: string;
  municipalityId: string;
  municipalityName: string;
  code: string;
  name: string;
  type: string;
  address?: string;
  operationalStatus: string;
  coordinatesValidated: boolean;
  active: boolean;
  updatedAt: string;
}
export interface TerritorialCatalog {
  municipalities: MunicipalityRecord[];
  facilities: FacilityRecord[];
}
export interface HealthNetworkRecord {
  id: string;
  regionId: string;
  regionName: string;
  code: string;
  name: string;
  description?: string;
  operationalStatus: string;
  startDate: string;
  active: boolean;
  municipalities: { id: string; code: string; name: string; startDate: string }[];
  updatedAt: string;
}
export interface TerritorialAuditEventRecord {
  id: string;
  action: string;
  entity: string;
  reason?: string;
  actorName?: string;
  createdAt: string;
}
export interface TerritorialAuditPage {
  items: TerritorialAuditEventRecord[];
  nextCursor?: string;
}

@Injectable({ providedIn: 'root' })
export class TerritorialApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private get base() {
    return `${this.config.apiUrl}/v1`;
  }

  listRegions() {
    return this.http.get<RegionRecord[]>(`${this.base}/regions`);
  }
  listCatalog() {
    return this.http.get<TerritorialCatalog>(`${this.base}/territories/catalog`);
  }
  createRegion(input: { code: string; name: string; type: string; reason: string }) {
    return this.http.post<RegionRecord>(`${this.base}/regions`, input);
  }
  createMunicipality(input: {
    regionId: string;
    officialCode: string;
    name: string;
    reason: string;
  }) {
    return this.http.post<MunicipalityRecord>(`${this.base}/territories/municipalities`, input);
  }
  createFacility(input: {
    municipalityId: string;
    code: string;
    name: string;
    type: string;
    address?: string;
    reason: string;
  }) {
    return this.http.post<FacilityRecord>(`${this.base}/territories/facilities`, input);
  }
  listNetworks() {
    return this.http.get<HealthNetworkRecord[]>(`${this.base}/territories/networks`);
  }
  listMunicipalityAudit(municipalityId: string, cursor?: string) {
    const params: Record<string, string> = { municipalityId, limit: '25' };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<TerritorialAuditPage>(`${this.base}/territories/audit-events`, { params });
  }
  listNetworkAudit(networkId: string, cursor?: string) {
    const params: Record<string, string> = { networkId, limit: '25' };
    if (cursor) params['cursor'] = cursor;
    return this.http.get<TerritorialAuditPage>(`${this.base}/territories/audit-events`, { params });
  }
  createNetwork(input: {
    regionId: string;
    code: string;
    name: string;
    description?: string;
    operationalStatus: string;
    startDate: string;
    municipalityIds: string[];
    reason: string;
  }) {
    return this.http.post<HealthNetworkRecord>(`${this.base}/territories/networks`, input);
  }
  replaceNetworkMunicipalities(
    networkId: string,
    municipalityIds: string[],
    effectiveDate: string,
    expectedUpdatedAt: string,
    reason: string,
  ) {
    return this.http.put<HealthNetworkRecord>(
      `${this.base}/territories/networks/${networkId}/municipalities`,
      { municipalityIds, effectiveDate, expectedUpdatedAt, reason },
    );
  }
  updateNetworkStatus(
    networkId: string,
    status: string,
    expectedUpdatedAt: string,
    reason: string,
  ) {
    return this.http.patch<HealthNetworkRecord>(
      `${this.base}/territories/networks/${networkId}/status`,
      { status, expectedUpdatedAt, reason },
    );
  }
  updateTerritorialStatus(
    entityType: 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO',
    id: string,
    status: string,
    expectedUpdatedAt: string,
    reason: string,
  ) {
    return this.http.patch<{
      id: string;
      operationalStatus: string;
      active: boolean;
      updatedAt: string;
    }>(`${this.base}/territories/${entityType}/${id}/status`, {
      status,
      expectedUpdatedAt,
      reason,
    });
  }
}
