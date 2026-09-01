import type {
  ClaimedExportJob,
  CreateExportJobInput,
  ExportArtifactDownload,
  ExportJob,
  ExportJobClaim,
} from '../../domain/export-job';

export abstract class ExportJobRepository {
  abstract listOwn(userId: string, limit: number): Promise<ExportJob[]>;
  abstract create(input: CreateExportJobInput): Promise<ExportJob>;
  abstract recoverStaleExhausted(staleAfterMs: number): Promise<number>;
  abstract claimNext(staleAfterMs: number): Promise<ClaimedExportJob | null>;
  abstract complete(claim: ExportJobClaim, storageKey: string, expiresAt: Date): Promise<boolean>;
  abstract fail(claim: ExportJobClaim, errorCode: string): Promise<boolean>;
  abstract listExpiredArtifacts(expiredBefore: Date, limit: number): Promise<ExpiredArtifact[]>;
  abstract clearArtifact(jobId: string, storageKey: string): Promise<boolean>;
  abstract getOwnDownload(jobId: string, userId: string): Promise<ExportArtifactDownload>;
  abstract recordDownloadServed(
    jobId: string,
    userId: string,
    requestId: string,
    dataLevel: 'INDIVIDUAL' | 'AGREGADO',
  ): Promise<void>;
}

export interface ExpiredArtifact {
  jobId: string;
  storageKey: string;
  expiredAt: Date;
}
