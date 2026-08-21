import { Injectable } from '@nestjs/common';
import type { AuthorizationSubject } from '../../authorization/domain/authorization.types';
import type { ExportFormat } from '../domain/export-job';
import { ExportArtifactStorage } from './ports/export-artifact.storage';
import { ExportJobRepository } from './ports/export-job.repository';

export interface DownloadedExportArtifact {
  contents: Uint8Array;
  filename: string;
  format: ExportFormat;
}

@Injectable()
export class DownloadExportArtifactUseCase {
  constructor(
    private readonly jobs: ExportJobRepository,
    private readonly storage: ExportArtifactStorage,
  ) {}

  async execute(
    jobId: string,
    subject: AuthorizationSubject,
    requestId: string,
  ): Promise<DownloadedExportArtifact> {
    const artifact = await this.jobs.acquireDownload(jobId, subject.userId, requestId);
    return { ...artifact, contents: await this.storage.read(artifact.storageKey) };
  }
}
