import { computed, Injectable, signal } from '@angular/core';
import { RoleId } from './models';
import { ROLE_PROFILES } from './role-data';
import type { CurrentInstitutionalProfile } from './current-profile-api.service';

export interface EffectiveTerritorialScope {
  level: 'NACIONAL' | 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';
  territoryId?: string;
}

@Injectable({ providedIn: 'root' })
export class RoleContext {
  readonly roles = ROLE_PROFILES;
  readonly activeRoleId = signal<RoleId>('municipal-coordinator');
  readonly institutionalProfile = signal<CurrentInstitutionalProfile | null>(null);
  readonly activeRole = computed(
    () => this.roles.find((role) => role.id === this.activeRoleId()) ?? this.roles[0],
  );
  readonly effectiveScope = computed<EffectiveTerritorialScope | null>(() => {
    const territory = this.institutionalProfile()?.territory;
    if (!territory) return null;
    if (territory.national) return { level: 'NACIONAL' };
    if (territory.regionGrantIds?.[0])
      return { level: 'REGION', territoryId: territory.regionGrantIds[0] };
    if (territory.municipalityGrantIds?.[0])
      return { level: 'MUNICIPIO', territoryId: territory.municipalityGrantIds[0] };
    if (territory.facilityGrantIds?.[0])
      return { level: 'ESTABLECIMIENTO', territoryId: territory.facilityGrantIds[0] };
    return null;
  });

  select(roleId: RoleId) {
    if (this.roles.some((role) => role.id === roleId)) this.activeRoleId.set(roleId);
  }
}
