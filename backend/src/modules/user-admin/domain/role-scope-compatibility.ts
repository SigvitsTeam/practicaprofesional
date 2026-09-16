import {
  RoleCode,
  type TerritorialScopeType,
} from '../../authorization/domain/authorization.types';

export const TERRITORIAL_SCOPE_TYPES = [
  'NACIONAL',
  'REGION',
  'MUNICIPIO',
  'ESTABLECIMIENTO',
] as const satisfies readonly TerritorialScopeType[];

export const ROLE_SCOPE_COMPATIBILITY = {
  [RoleCode.SuperAdmin]: ['NACIONAL'],
  [RoleCode.CentralAdmin]: ['NACIONAL'],
  [RoleCode.RegionalSuperAdmin]: ['REGION'],
  [RoleCode.RegionalAdmin]: ['REGION'],
  [RoleCode.MunicipalCoordinator]: ['MUNICIPIO'],
  [RoleCode.CoordinationDataEntry]: ['MUNICIPIO', 'ESTABLECIMIENTO'],
  [RoleCode.FacilityManager]: ['ESTABLECIMIENTO'],
  [RoleCode.ReadOnlySupervisor]: ['REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'],
} as const satisfies Readonly<Record<RoleCode, readonly TerritorialScopeType[]>>;

export function isInstitutionalRoleCode(value: string): value is RoleCode {
  return Object.prototype.hasOwnProperty.call(ROLE_SCOPE_COMPATIBILITY, value);
}

export function isTerritorialScopeType(value: string): value is TerritorialScopeType {
  return (TERRITORIAL_SCOPE_TYPES as readonly string[]).includes(value);
}

export function isRoleScopeCompatible(
  roleCode: RoleCode,
  scopeType: TerritorialScopeType,
): boolean {
  return ROLE_SCOPE_COMPATIBILITY[roleCode].some((allowedScope) => allowedScope === scopeType);
}
