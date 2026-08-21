import type { CreateExportJobInput, ExportJob } from '../../domain/export-job';

export abstract class ExportJobRepository {
  abstract listOwn(userId: string, limit: number): Promise<ExportJob[]>;
  abstract create(input: CreateExportJobInput): Promise<ExportJob>;
}
