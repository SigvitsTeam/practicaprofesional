export type UserScopeType = 'NACIONAL' | 'REGION' | 'MUNICIPIO' | 'ESTABLECIMIENTO';

interface UserRoleOption {
  code: string;
  label: string;
  scopes: readonly UserScopeType[];
  globalOnly?: boolean;
}

// Mirrors ManagedUsersUseCase. The API remains authoritative for permission and territory checks.
export const USER_ROLE_OPTIONS: readonly UserRoleOption[] = [
  { code: 'ADMIN_CENTRAL', label: 'Admin Central', scopes: ['NACIONAL'], globalOnly: true },
  {
    code: 'SUPERADMIN_REGIONAL',
    label: 'SuperAdmin Regional',
    scopes: ['REGION'],
    globalOnly: true,
  },
  { code: 'ADMIN_REGIONAL', label: 'Admin Regional', scopes: ['REGION'] },
  { code: 'COORDINADOR_MUNICIPAL', label: 'Coordinador Municipal', scopes: ['MUNICIPIO'] },
  {
    code: 'DIGITADOR_COORDINACION',
    label: 'Digitador de Coordinación',
    scopes: ['ESTABLECIMIENTO'],
  },
  {
    code: 'RESPONSABLE_ESTABLECIMIENTO',
    label: 'Responsable de Establecimiento',
    scopes: ['ESTABLECIMIENTO'],
  },
  {
    code: 'SUPERVISOR_CONSULTA',
    label: 'Supervisor o Consulta',
    scopes: ['REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'],
  },
];

export const USER_SCOPE_LABELS: Readonly<Record<UserScopeType, string>> = {
  NACIONAL: 'Nacional',
  REGION: 'Región',
  MUNICIPIO: 'Municipio',
  ESTABLECIMIENTO: 'Establecimiento',
};

export const USER_TARGET_LABELS: Readonly<Record<UserScopeType, string>> = {
  NACIONAL: 'Honduras',
  REGION: 'Región asignada',
  MUNICIPIO: 'Municipio asignado',
  ESTABLECIMIENTO: 'Establecimiento asignado',
};

export function userRoleOptions(globalScope: boolean): readonly UserRoleOption[] {
  return USER_ROLE_OPTIONS.filter((role) => globalScope || !role.globalOnly);
}

export function userScopeOptions(roleCode: string, globalScope: boolean): readonly UserScopeType[] {
  return userRoleOptions(globalScope).find((role) => role.code === roleCode)?.scopes ?? [];
}
