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
  updatedAt: Date;
}

export interface AttentionRecord {
  id: string;
  facilityId: string;
  attentionDate: Date;
  patientRecordNumber: string;
  originText: string;
  sex: BiologicalSex;
  age: number;
  populationType: { id: string; code: string; name: string };
  isContact: boolean;
  isPregnant: boolean;
  possibleDuplicate: boolean;
  observation?: string;
  diagnoses: readonly {
    diseaseId: string;
    diseaseName: string;
    caseType: DiagnosisCaseType;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AttentionPage {
  items: readonly AttentionRecord[];
  nextCursor?: string;
}

export interface AttentionCursor {
  attentionDate: Date;
  id: string;
}

export interface UpdateAttentionInput extends CreateAttentionInput {
  id: string;
  expectedUpdatedAt: Date;
}

export interface PersistAttentionUpdateInput extends PersistAttentionInput {
  id: string;
  expectedUpdatedAt: Date;
}

export interface CancelAttentionInput {
  id: string;
  facilityId: string;
  expectedUpdatedAt: Date;
  userId: string;
  requestId: string;
  reason: string;
}

export interface CancelledAttention {
  id: string;
  status: 'ANULADO';
  updatedAt: Date;
}

export interface CaptureContext {
  facilities: readonly {
    id: string;
    code: string;
    name: string;
    type: string;
    municipality: { id: string; code: string; name: string };
    region: { id: string; code: string; name: string };
  }[];
  populationTypes: readonly { id: string; code: string; name: string }[];
  classifications: readonly {
    id: string;
    code: string;
    name: string;
    diseases: readonly {
      id: string;
      code?: string;
      name: string;
      appliesToMale: boolean;
      appliesToFemale: boolean;
    }[];
  }[];
}

export class InvalidAttentionError extends Error {}
export class CaptureConfigurationError extends Error {}
export class AttentionNotFoundError extends Error {}
export class AttentionNotEditableError extends Error {}
export class ConcurrentAttentionUpdateError extends Error {}
