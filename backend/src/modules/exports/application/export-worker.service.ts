import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { MetricsService } from '../../../common/observability/metrics.service';
import { exportConfig } from '../../../config/app.config';
import { ExportArtifactStorage } from './ports/export-artifact.storage';
import { ExportJobRepository, type ExpiredArtifact } from './ports/export-job.repository';
import { ExportArtifactGenerator } from './export-artifact.generator';

const MAX_CLEANUP_BATCHES_PER_RUN = 10;
const MAX_CLEANUP_DURATION_MS = 10_000;

@Injectable()
export class ExportWorkerService {
  private readonly logger = new Logger(ExportWorkerService.name);
  private lastCleanupAt = 0;
  constructor(
    private readonly jobs: ExportJobRepository,
    private readonly generator: ExportArtifactGenerator,
    private readonly storage: ExportArtifactStorage,
    @Inject(exportConfig.KEY) private readonly config: ConfigType<typeof exportConfig>,
    private readonly metrics: MetricsService,
  ) {}

  async runOnce(): Promise<boolean> {
    await this.cleanupExpiredArtifactsIfDue();
    const job = await this.jobs.claimNext(this.config.staleAfterMs);
    this.metrics.recordWorkerPoll(true);
    if (!job) return false;
    const startedAt = performance.now();
    this.metrics.recordWorkerJobStarted();
    this.metrics.recordExportJob('claimed', job.format);
    try {
      const contents = await this.generator.generate(job);
      const storageKey = await this.storage.write(job.id, job.format, contents);
      await this.jobs.complete(
        job.id,
        storageKey,
        new Date(Date.now() + this.config.artifactTtlMs),
      );
      this.metrics.recordExportJob('completed', job.format);
      this.logger.log(`Export job completed id=${job.id} format=${job.format}`);
    } catch {
      const code = 'EXPORT_GENERATION_FAILED';
      await this.jobs.fail(job.id, code);
      this.metrics.recordExportJob('failed', job.format);
      this.logger.error(`Export job failed id=${job.id} code=${code}`);
    } finally {
      this.metrics.recordExportDuration(job.format, (performance.now() - startedAt) / 1_000);
      this.metrics.recordWorkerJobFinished();
    }
    return true;
  }

  recordPollFailure(): void {
    this.metrics.recordWorkerPoll(false);
  }

  recordStopping(): void {
    this.metrics.recordWorkerStopping();
  }

  isReady(maxPollAgeMs: number): boolean {
    return this.metrics.isWorkerReady(maxPollAgeMs);
  }

  private async cleanupExpiredArtifactsIfDue(): Promise<void> {
    const now = Date.now();
    if (now - this.lastCleanupAt < this.config.artifactCleanupIntervalMs) return;
    this.lastCleanupAt = now;
    const expiredBefore = new Date(now - this.config.artifactCleanupGraceMs);
    const deadline = performance.now() + MAX_CLEANUP_DURATION_MS;
    for (let batch = 0; batch < MAX_CLEANUP_BATCHES_PER_RUN; batch += 1) {
      const artifacts = await this.scanExpiredArtifacts(expiredBefore);
      if (!artifacts) return;
      if (artifacts.length === 0) {
        this.metrics.recordArtifactCleanupBacklog(0);
        return;
      }
      this.metrics.recordArtifactCleanupBacklog(artifacts.length, artifacts[0]?.expiredAt);
      const failed: ExpiredArtifact[] = [];
      for (const [index, artifact] of artifacts.entries()) {
        if (performance.now() >= deadline) {
          const remaining = [...failed, ...artifacts.slice(index)];
          this.metrics.recordArtifactCleanupBacklog(
            remaining.length,
            this.oldestExpiration(remaining),
          );
          this.metrics.recordArtifactCleanupLimitReached();
          return;
        }
        if (!(await this.deleteExpiredArtifact(artifact))) failed.push(artifact);
      }
      if (failed.length > 0) {
        this.metrics.recordArtifactCleanupBacklog(failed.length, this.oldestExpiration(failed));
        return;
      }
      if (artifacts.length < this.config.artifactCleanupBatchSize) {
        this.metrics.recordArtifactCleanupBacklog(0);
        return;
      }
    }
    this.metrics.recordArtifactCleanupLimitReached();
    if (performance.now() >= deadline) return;
    const backlog = await this.scanExpiredArtifacts(expiredBefore);
    if (backlog)
      this.metrics.recordArtifactCleanupBacklog(backlog.length, this.oldestExpiration(backlog));
  }

  private async scanExpiredArtifacts(expiredBefore: Date): Promise<ExpiredArtifact[] | null> {
    try {
      return await this.jobs.listExpiredArtifacts(
        expiredBefore,
        this.config.artifactCleanupBatchSize,
      );
    } catch {
      this.metrics.recordArtifactCleanup('failed');
      this.logger.warn('Expired export cleanup scan failed');
      return null;
    }
  }

  private async deleteExpiredArtifact(artifact: ExpiredArtifact): Promise<boolean> {
    try {
      await this.storage.delete(artifact.storageKey);
      const cleared = await this.jobs.clearArtifact(artifact.jobId, artifact.storageKey);
      if (cleared) this.metrics.recordArtifactCleanup('deleted');
      return true;
    } catch (error: unknown) {
      this.metrics.recordArtifactCleanup('failed');
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      this.logger.warn(
        `Expired export cleanup failed id=${artifact.jobId} error=${errorName.slice(0, 80)}`,
      );
      return false;
    }
  }

  private oldestExpiration(artifacts: readonly ExpiredArtifact[]): Date | undefined {
    return artifacts.reduce<Date | undefined>(
      (oldest, artifact) => (!oldest || artifact.expiredAt < oldest ? artifact.expiredAt : oldest),
      undefined,
    );
  }
}
