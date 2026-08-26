import { describe, expect, it } from 'vitest';
import { diseasesApplicableToSex, isDiseaseApplicableToSex } from './disease-applicability';

const diseases = [
  { id: 'male', name: 'Flujo uretral', appliesToMale: true, appliesToFemale: false },
  { id: 'female', name: 'Cervicitis', appliesToMale: false, appliesToFemale: true },
  { id: 'both', name: 'Sífilis', appliesToMale: true, appliesToFemale: true },
];

describe('disease applicability', () => {
  it('exposes only male-compatible diseases for Hombre', () => {
    expect(diseasesApplicableToSex(diseases, 'Hombre').map((item) => item.id)).toEqual([
      'male',
      'both',
    ]);
  });

  it('exposes only female-compatible diseases for Mujer', () => {
    expect(diseasesApplicableToSex(diseases, 'Mujer').map((item) => item.id)).toEqual([
      'female',
      'both',
    ]);
  });

  it('does not expose diseases until a sex is selected', () => {
    expect(diseasesApplicableToSex(diseases, '')).toEqual([]);
    expect(isDiseaseApplicableToSex(diseases[0]!, null)).toBe(false);
  });
});
