import type {
  CaptureReferences,
  CreatedAttention,
  PersistAttentionInput,
} from '../../domain/its-attention';

export abstract class ItsAttentionRepository {
  abstract resolveReferences(input: {
    facilityId: string;
    attentionDate: Date;
    age: number;
    populationTypeId: string;
    diseaseIds: readonly string[];
  }): Promise<CaptureReferences>;
  abstract hasPossibleDuplicate(input: {
    facilityId: string;
    attentionDate: Date;
    patientRecordNumber: string;
  }): Promise<boolean>;
  abstract create(input: PersistAttentionInput): Promise<CreatedAttention>;
}
