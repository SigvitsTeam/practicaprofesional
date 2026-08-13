import type {
  CaptureContext,
  CaptureReferences,
  CreatedAttention,
  PersistAttentionInput,
} from '../../domain/its-attention';

export abstract class ItsAttentionRepository {
  abstract getCaptureContext(facilityIds: readonly string[]): Promise<CaptureContext>;
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
