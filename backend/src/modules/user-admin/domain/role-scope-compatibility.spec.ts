import {
  RoleCode,
  type TerritorialScopeType,
} from '../../authorization/domain/authorization.types';
import {
  isInstitutionalRoleCode,
  isRoleScopeCompatible,
  isTerritorialScopeType,
} from './role-scope-compatibility';

describe('role and territorial scope compatibility', () => {
  const scopes: TerritorialScopeType[] = ['NACIONAL', 'REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'];
  const expected: Record<RoleCode, readonly TerritorialScopeType[]> = {
    [RoleCode.SuperAdmin]: ['NACIONAL'],
    [RoleCode.CentralAdmin]: ['NACIONAL'],
    [RoleCode.RegionalSuperAdmin]: ['REGION'],
    [RoleCode.RegionalAdmin]: ['REGION'],
    [RoleCode.MunicipalCoordinator]: ['MUNICIPIO'],
    [RoleCode.CoordinationDataEntry]: ['MUNICIPIO', 'ESTABLECIMIENTO'],
    [RoleCode.FacilityManager]: ['ESTABLECIMIENTO'],
    [RoleCode.ReadOnlySupervisor]: ['REGION', 'MUNICIPIO', 'ESTABLECIMIENTO'],
  };

  it.each(
    Object.values(RoleCode).flatMap((roleCode) =>
      scopes.map((scopeType) => ({
        roleCode,
        scopeType,
        compatible: expected[roleCode].includes(scopeType),
      })),
    ),
  )('$roleCode con $scopeType: compatible=$compatible', ({ roleCode, scopeType, compatible }) => {
    expect(isRoleScopeCompatible(roleCode, scopeType)).toBe(compatible);
  });

  it('rechaza códigos ajenos a la matriz institucional', () => {
    expect(isInstitutionalRoleCode('ROL_DESCONOCIDO')).toBe(false);
    expect(isTerritorialScopeType('DEPARTAMENTO')).toBe(false);
  });
});
