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
  abstract acquireDownload(
    jobId: string,
    userId: string,
    requestId: string,
  ): Promise<ExportArtifactDownload>;
}
