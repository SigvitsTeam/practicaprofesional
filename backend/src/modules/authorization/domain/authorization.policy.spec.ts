import { AuthorizationPolicy } from './authorization.policy';
import { DataLevel, RoleCode, type AuthorizationSubject } from './authorization.types';

describe('AuthorizationPolicy', () => {
  const policy = new AuthorizationPolicy();
  const capturePermission = 'its1:read';

  function subject(overrides: Partial<AuthorizationSubject>): AuthorizationSubject {
    return {
      userId: 'user-1',
      roles: [],
      permissions: [capturePermission],
      territory: {
        national: false,
        regionIds: ['region-cortes'],
        municipalityIds: ['municipality-puerto-cortes'],
        facilityIds: ['facility-1'],
      },
      ...overrides,
    };
  }

  it('denies by default when the explicit permission is missing', () => {
    const decision = policy.evaluate(subject({ permissions: [] }), {
      permission: capturePermission,
      dataLevel: DataLevel.Aggregated,
      target: { regionId: 'region-cortes' },
    });

    expect(decision).toEqual({ allowed: false, reason: 'MISSING_PERMISSION' });
  });

  it('allows a facility manager to access ITS 1 only for the assigned facility', () => {
    const actor = subject({ roles: [RoleCode.FacilityManager] });

    expect(
      policy.evaluate(actor, {
        permission: capturePermission,
        dataLevel: DataLevel.Individual,
        target: {
          regionId: 'region-cortes',
          municipalityId: 'municipality-puerto-cortes',
          facilityId: 'facility-1',
        },
      }),
    ).toEqual({ allowed: true });

    expect(
      policy.evaluate(actor, {
        permission: capturePermission,
        dataLevel: DataLevel.Individual,
        target: { facilityId: 'facility-2' },
      }),
    ).toEqual({ allowed: false, reason: 'OUTSIDE_TERRITORY' });
  });

  it('allows the coordination data-entry role within its selected facility context', () => {
    const actor = subject({ roles: [RoleCode.CoordinationDataEntry] });
    const decision = policy.evaluate(actor, {
      permission: capturePermission,
      dataLevel: DataLevel.Individual,
      target: {
        municipalityId: 'municipality-puerto-cortes',
        facilityId: 'facility-1',
      },
    });

    expect(decision).toEqual({ allowed: true });
  });

  it.each([RoleCode.MunicipalCoordinator, RoleCode.RegionalAdmin, RoleCode.CentralAdmin])(
    'does not grant individual data access to %s even when it has the action permission',
    (role) => {
      const decision = policy.evaluate(subject({ roles: [role] }), {
        permission: capturePermission,
        dataLevel: DataLevel.Individual,
        target: {
          municipalityId: 'municipality-puerto-cortes',
          facilityId: 'facility-1',
        },
      });

      expect(decision).toEqual({ allowed: false, reason: 'INDIVIDUAL_DATA_RESTRICTED' });
    },
  );

  it('does not let a regional superadmin cross its assigned region', () => {
    const decision = policy.evaluate(subject({ roles: [RoleCode.RegionalSuperAdmin] }), {
      permission: capturePermission,
      dataLevel: DataLevel.Configuration,
      target: { regionId: 'region-atlantida' },
    });

    expect(decision).toEqual({ allowed: false, reason: 'OUTSIDE_TERRITORY' });
  });

  it('does not give a system superadmin implicit ITS 1 access', () => {
    const actor = subject({
      roles: [RoleCode.SuperAdmin],
      permissions: ['*'],
      territory: {
        national: true,
        regionIds: [],
        municipalityIds: [],
        facilityIds: [],
      },
    });

    const decision = policy.evaluate(actor, {
      permission: capturePermission,
      dataLevel: DataLevel.Individual,
      target: { facilityId: 'facility-1' },
    });

    expect(decision).toEqual({ allowed: false, reason: 'INDIVIDUAL_DATA_RESTRICTED' });
  });

  it('requires an explicit national assignment for national operations', () => {
    const decision = policy.evaluate(subject({ roles: [RoleCode.RegionalSuperAdmin] }), {
      permission: capturePermission,
      dataLevel: DataLevel.Configuration,
      target: { national: true },
    });

    expect(decision).toEqual({ allowed: false, reason: 'OUTSIDE_TERRITORY' });
  });
});
