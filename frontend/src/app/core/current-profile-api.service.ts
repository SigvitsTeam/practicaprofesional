import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { RuntimeConfigService } from './runtime-config.service';

export interface CurrentInstitutionalProfile {
  userId: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
  territory: {
    national: boolean;
    regionIds: string[];
    municipalityIds: string[];
    facilityIds: string[];
  };
}

@Injectable({ providedIn: 'root' })
export class CurrentProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RuntimeConfigService);

  get() {
    return this.http.get<CurrentInstitutionalProfile>(`${this.config.apiUrl}/v1/auth/me`);
  }
}
