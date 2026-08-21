import { Injectable } from '@nestjs/common';
import { AuthorizationPolicy } from '../../authorization/domain/authorization.policy';
import {
  DataLevel,
  type AuthorizationSubject,
  type TargetTerritory,
} from '../../authorization/domain/authorization.types';
import { ExportArtifactAccessError, type ExportFormat } from '../domain/export-job';
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
    private readonly authorization: AuthorizationPolicy,
  ) {}

  async execute(
    jobId: string,
    subject: AuthorizationSubject,
    requestId: string,
  ): Promise<DownloadedExportArtifact> {
    const artifact = await this.jobs.getOwnDownload(jobId, subject.userId);
    const individual = artifact.reportType === 'ITS1_REGISTER';
    const decision = this.authorization.evaluate(subject, {
      permission: individual ? 'its1:attentions:read' : 'exports:jobs:read',
      dataLevel: individual ? DataLevel.Individual : DataLevel.Aggregated,
      target: this.target(artifact.scopeLevel, artifact.territoryId),
    });
    if (!decision.allowed) throw new ExportArtifactAccessError('Acceso denegado al archivo.');
    const contents = await this.storage.read(artifact.storageKey);
    await this.jobs.recordDownloadServed(
      jobId,
      subject.userId,
      requestId,
      individual ? 'INDIVIDUAL' : 'AGREGADO',
    );
    return { ...artifact, contents };
  }

  private target(scopeLevel: string, territoryId: string | null): TargetTerritory {
    if (scopeLevel === 'NACIONAL') return { national: true };
    if (scopeLevel === 'REGION') return { regionId: territoryId ?? undefined };
    if (scopeLevel === 'MUNICIPIO') return { municipalityId: territoryId ?? undefined };
    return { facilityId: territoryId ?? undefined };
  }
}
