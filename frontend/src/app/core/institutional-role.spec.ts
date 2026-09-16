import { describe, expect, it } from 'vitest';
import { mapInstitutionalRoleCodes } from './institutional-role';

describe('mapInstitutionalRoleCodes', () => {
  it('maps backend role codes to the corresponding institutional screens', () => {
    expect(mapInstitutionalRoleCodes(['ADMIN_CENTRAL', 'RESPONSABLE_ESTABLECIMIENTO'])).toEqual([
      'central-validator',
      'establishment-manager',
    ]);
  });

  it('ignores unknown codes and removes duplicates', () => {
    expect(mapInstitutionalRoleCodes(['ADMIN_REGIONAL', 'UNKNOWN', 'ADMIN_REGIONAL'])).toEqual([
      'regional-admin',
    ]);
  });

  it.each([
    [['RESPONSABLE_ESTABLECIMIENTO', 'SUPERADMIN', 'ADMIN_CENTRAL'], ['superadmin']],
    [['ADMIN_REGIONAL', 'SUPERADMIN_REGIONAL', 'SUPERVISOR_CONSULTA'], ['regional-superadmin']],
    [
      ['SUPERADMIN_REGIONAL', 'COORDINADOR_MUNICIPAL', 'SUPERADMIN'],
      ['regional-superadmin', 'superadmin'],
    ],
  ])(
    'exposes only administrative profiles when a superadministrator role is present',
    (codes, roles) => {
      expect(mapInstitutionalRoleCodes(codes)).toEqual(roles);
    },
  );
});
