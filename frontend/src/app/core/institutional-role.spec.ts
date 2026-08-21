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
});
