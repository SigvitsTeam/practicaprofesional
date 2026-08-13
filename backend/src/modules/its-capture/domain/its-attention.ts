export type BiologicalSex = 'H' | 'M';
export type DiagnosisCaseType = 'NUEVO' | 'CONTROL';

export interface AttentionDiagnosisInput {
  diseaseId: string;
  caseType: DiagnosisCaseType;
}

export interface CreateAttentionInput {
  facilityId: string;
  attentionDate: Date;
  patientRecordNumber: string;
  originText: string;
  sex: BiologicalSex;
  age: number;
  populationTypeId: string;
  isContact: boolean;
  isPregnant: boolean;
  observation?: string;
  diagnoses: readonly AttentionDiagnosisInput[];
}

export interface CaptureReferences {
  facility?: { id: string; municipalityId: string; regionId: string };
  programId?: string;
  epidemiologicalWeekId?: string;
  monthlyPeriodId?: string;
  ageGroupId?: string;
  comparativeAgeGroupId?: string;
  populationTypeValid: boolean;
  diseases: readonly { id: string; appliesToMale: boolean; appliesToFemale: boolean }[];
}

export interface PersistAttentionInput extends CreateAttentionInput {
  userId: string;
  requestId: string;
  programId: string;
  epidemiologicalWeekId: string;
  monthlyPeriodId: string;
  regionId: string;
  municipalityId: string;
  ageGroupId: string;
  comparativeAgeGroupId: string;
  possibleDuplicate: boolean;
}

export interface CreatedAttention {
  id: string;
  possibleDuplicate: boolean;
  createdAt: Date;
}

export class InvalidAttentionError extends Error {}
export class CaptureConfigurationError extends Error {}
