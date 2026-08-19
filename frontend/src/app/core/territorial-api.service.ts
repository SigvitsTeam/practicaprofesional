import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';

export interface RegionRecord { id: string; code: string; name: string; regionNumber?: string; type: string; operationalStatus: string; active: boolean }
export interface MunicipalityRecord { id: string; regionId: string; regionName: string; officialCode: string; name: string; operationalStatus: string; mapValidated: boolean; active: boolean; facilityCount: number }
export interface FacilityRecord { id: string; municipalityId: string; municipalityName: string; code: string; name: string; type: string; address?: string; operationalStatus: string; coordinatesValidated: boolean; active: boolean }
export interface TerritorialCatalog { municipalities: MunicipalityRecord[]; facilities: FacilityRecord[] }

@Injectable({ providedIn: 'root' })
export class TerritorialApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);
  private get base() { return `${this.config.apiUrl}/v1`; }

  listRegions() { return this.http.get<RegionRecord[]>(`${this.base}/regions`); }
  listCatalog() { return this.http.get<TerritorialCatalog>(`${this.base}/territories/catalog`); }
  createRegion(input: { code: string; name: string; type: string; reason: string }) {
    return this.http.post<RegionRecord>(`${this.base}/regions`, input);
  }
  createMunicipality(input: { regionId: string; officialCode: string; name: string; reason: string }) {
    return this.http.post<MunicipalityRecord>(`${this.base}/territories/municipalities`, input);
  }
  createFacility(input: { municipalityId: string; code: string; name: string; type: string; address?: string; reason: string }) {
    return this.http.post<FacilityRecord>(`${this.base}/territories/facilities`, input);
  }
}
