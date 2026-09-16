import {
  RoleCode,
  type AuthorizationSubject,
} from '../../authorization/domain/authorization.types';
import type { ExportScopeLevel } from '../domain/export-job';

export function isAdministrativeOnlySubject(subject: AuthorizationSubject): boolean {
  return subject.roles.some(
    (role) => role === RoleCode.SuperAdmin || role === RoleCode.RegionalSuperAdmin,
  );
}

export function defaultExportTerritory(
  level: ExportScopeLevel,
  subject: AuthorizationSubject,
): string | null {
  if (level === 'NACIONAL') return null;
  if (level === 'REGION') return subject.territory.regionGrantIds?.[0] ?? null;
  if (level === 'MUNICIPIO')
    return (
      subject.territory.municipalityScopeIds?.[0] ??
      subject.territory.municipalityGrantIds?.[0] ??
      null
    );
  return subject.territory.facilityIds[0] ?? null;
}

/**
 * Export scopes are grants, not the parent IDs added only to describe context.
 * This prevents a facility grant from becoming municipal or regional access.
 */
export function isExportScopeAllowed(
  level: ExportScopeLevel,
  territoryId: string | null,
  subject: AuthorizationSubject,
): boolean {
  if (isAdministrativeOnlySubject(subject)) return false;
  if (level === 'NACIONAL') return !territoryId && subject.territory.national;
  if (!territoryId) return false;
  if (subject.territory.national) return true;
  if (level === 'REGION') return (subject.territory.regionGrantIds ?? []).includes(territoryId);
  if (level === 'MUNICIPIO')
    return (
      subject.territory.municipalityScopeIds ??
      subject.territory.municipalityGrantIds ??
      []
    ).includes(territoryId);
  return subject.territory.facilityIds.includes(territoryId);
}
