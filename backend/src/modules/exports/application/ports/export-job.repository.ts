import type {
  ClaimedExportJob,
  CreateExportJobInput,
  ExportArtifactDownload,
  ExportJob,
} from '../../domain/export-job';

export abstract class ExportJobRepository {
  abstract listOwn(userId: string, limit: number): Promise<ExportJob[]>;
  abstract create(input: CreateExportJobInput): Promise<ExportJob>;
  abstract claimNext(staleAfterMs: number): Promise<ClaimedExportJob | null>;
  abstract complete(jobId: string, storageKey: string, expiresAt: Date): Promise<void>;
  abstract fail(jobId: string, errorCode: string): Promise<void>;
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
