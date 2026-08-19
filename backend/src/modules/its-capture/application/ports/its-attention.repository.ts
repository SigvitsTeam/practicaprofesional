import type {
  CaptureContext,
  CaptureReferences,
  CreatedAttention,
  AttentionCursor,
  AttentionRecord,
  PersistAttentionInput,
  PersistAttentionUpdateInput,
  CancelAttentionInput,
  CancelledAttention,
} from '../../domain/its-attention';
import type { MonthlyReportSource } from '../../domain/its-monthly-report';
import type { Its1PrintRegister } from '../../domain/its1-print-register';

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
    excludeAttentionId?: string;
  }): Promise<boolean>;
  abstract create(input: PersistAttentionInput): Promise<CreatedAttention>;
  abstract list(input: {
    facilityId: string;
    year: number;
    month: number;
    limit: number;
    cursor?: AttentionCursor;
  }): Promise<readonly AttentionRecord[]>;
  abstract update(input: PersistAttentionUpdateInput): Promise<AttentionRecord>;
  abstract cancel(input: CancelAttentionInput): Promise<CancelledAttention>;
  abstract getMonthlyReportSource(input: {
    facilityId: string;
    year: number;
    month: number;
  }): Promise<MonthlyReportSource>;
  abstract getIts1PrintRegister(input: {
    facilityId: string;
    userId: string;
    year: number;
    month: number;
  }): Promise<Its1PrintRegister>;
}
