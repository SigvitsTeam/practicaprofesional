export type CaptureSexSelection = '' | 'Hombre' | 'Mujer';

export interface SexApplicableDisease {
  id: string;
  name: string;
  appliesToMale: boolean;
  appliesToFemale: boolean;
}

export function isDiseaseApplicableToSex(
  disease: SexApplicableDisease,
  sex: CaptureSexSelection | string | null,
): boolean {
  if (sex === 'Hombre') return disease.appliesToMale;
  if (sex === 'Mujer') return disease.appliesToFemale;
  return false;
}

export function diseasesApplicableToSex<T extends SexApplicableDisease>(
  diseases: readonly T[],
  sex: CaptureSexSelection | string | null,
): T[] {
  return diseases.filter((disease) => isDiseaseApplicableToSex(disease, sex));
}
