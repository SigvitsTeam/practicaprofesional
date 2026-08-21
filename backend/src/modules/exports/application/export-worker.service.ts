import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { exportConfig } from '../../../config/app.config';
import { ExportArtifactStorage } from './ports/export-artifact.storage';
import { ExportJobRepository } from './ports/export-job.repository';
import { ExportArtifactGenerator } from './export-artifact.generator';

@Injectable()
export class ExportWorkerService {
  private readonly logger = new Logger(ExportWorkerService.name);
  constructor(
    private readonly jobs: ExportJobRepository,
    private readonly generator: ExportArtifactGenerator,
    private readonly storage: ExportArtifactStorage,
    @Inject(exportConfig.KEY) private readonly config: ConfigType<typeof exportConfig>,
  ) {}

  async runOnce(): Promise<boolean> {
    const job = await this.jobs.claimNext(this.config.staleAfterMs);
    if (!job) return false;
    try {
      const contents = await this.generator.generate(job);
      const storageKey = await this.storage.write(job.id, job.format, contents);
      await this.jobs.complete(
        job.id,
        storageKey,
        new Date(Date.now() + this.config.artifactTtlMs),
      );
      this.logger.log(`Export job completed id=${job.id} format=${job.format}`);
    } catch (error: unknown) {
      const code =
        error instanceof Error
          ? error.message.replace(/[^A-Z0-9_]/gi, '_').slice(0, 80)
          : 'UNEXPECTED_EXPORT_ERROR';
      await this.jobs.fail(job.id, code || 'UNEXPECTED_EXPORT_ERROR');
      this.logger.error(`Export job failed id=${job.id} code=${code}`);
    }
    return true;
  }
}
