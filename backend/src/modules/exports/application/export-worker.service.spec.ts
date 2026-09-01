import { MetricsService } from '../../../common/observability/metrics.service';
import type { ExportConfig } from '../../../config/app.config';
import type { ClaimedExportJob } from '../domain/export-job';
import { ExportWorkerService } from './export-worker.service';
import type { ExportArtifactGenerator } from './export-artifact.generator';
import type { ExportArtifactStorage } from './ports/export-artifact.storage';
import type { ExportJobRepository } from './ports/export-job.repository';

const job: ClaimedExportJob = {
  id: '11111111-1111-4111-8111-111111111111',
  requestedByUserId: '22222222-2222-4222-8222-222222222222',
  reportType: 'ITS2_MONTHLY',
  format: 'XLSX',
  scopeLevel: 'ESTABLECIMIENTO',
  territoryId: '33333333-3333-4333-8333-333333333333',
  year: 2026,
  month: 8,
  parameters: null,
  status: 'PROCESANDO',
  attempts: 1,
  maxAttempts: 3,
  outputAvailable: false,
  outputExpiresAt: null,
  errorCode: null,
  createdAt: new Date('2026-08-26T00:00:00Z'),
  updatedAt: new Date('2026-08-26T00:00:00Z'),
};

const config: ExportConfig = {
  storageDirectory: '.data/exports',
  workerPollMs: 2_000,
  staleAfterMs: 900_000,
  artifactTtlMs: 86_400_000,
  artifactCleanupIntervalMs: 900_000,
  artifactCleanupGraceMs: 300_000,
  artifactCleanupBatchSize: 100,
  workerMaxBackoffMs: 30_000,
  workerHealthPort: 3_001,
  workerHealthHost: '0.0.0.0',
};

describe('ExportWorkerService', () => {
  it('recovers expired final attempts before polling without sending them back to generation', async () => {
    const repository = {
      recoverStaleExhausted: jest.fn().mockResolvedValueOnce(1).mockResolvedValue(0),
      claimNext: jest.fn().mockResolvedValue(null),
      listExpiredArtifacts: jest.fn().mockResolvedValue([]),
    };
    const generator = { generate: jest.fn() };
    const worker = new ExportWorkerService(
      repository as unknown as ExportJobRepository,
      generator as unknown as ExportArtifactGenerator,
      {} as ExportArtifactStorage,
      config,
      new MetricsService(),
    );

    await expect(worker.runOnce()).resolves.toBe(false);
    await expect(worker.runOnce()).resolves.toBe(false);

    expect(repository.recoverStaleExhausted).toHaveBeenCalledTimes(2);
    expect(repository.recoverStaleExhausted).toHaveBeenCalledWith(config.staleAfterMs);
    const recoveryOrder = repository.recoverStaleExhausted.mock.invocationCallOrder[0];
    const claimOrder = repository.claimNext.mock.invocationCallOrder[0];
    if (recoveryOrder === undefined || claimOrder === undefined)
      throw new Error('Expected both queue recovery and polling to have run.');
    expect(recoveryOrder).toBeLessThan(claimOrder);
    expect(generator.generate).not.toHaveBeenCalled();
  });

  it('propagates recovery failures to the poll backoff without claiming more work', async () => {
    const repository = {
      recoverStaleExhausted: jest.fn().mockRejectedValue(new Error('recovery unavailable')),
      claimNext: jest.fn(),
      listExpiredArtifacts: jest.fn().mockResolvedValue([]),
    };
    const worker = new ExportWorkerService(
      repository as unknown as ExportJobRepository,
      {} as ExportArtifactGenerator,
      {} as ExportArtifactStorage,
      config,
      new MetricsService(),
    );

    await expect(worker.runOnce()).rejects.toThrow('recovery unavailable');

    expect(repository.claimNext).not.toHaveBeenCalled();
  });

  it('completes one atomically claimed job and emits worker metrics', async () => {
    const complete = jest.fn().mockResolvedValue(true);
    const repository = {
      recoverStaleExhausted: jest.fn().mockResolvedValue(0),
      claimNext: jest.fn().mockResolvedValue(job),
      complete,
      fail: jest.fn().mockResolvedValue(true),
      listExpiredArtifacts: jest.fn().mockResolvedValue([]),
      clearArtifact: jest.fn().mockResolvedValue(true),
    } as unknown as ExportJobRepository;
    const generator = {
      generate: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    } as unknown as ExportArtifactGenerator;
    const write = jest
      .fn()
      .mockResolvedValue('11/11111111-1111-4111-8111-111111111111.attempt-1.xlsx');
    const storage = {
      write,
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as ExportArtifactStorage;
    const metrics = new MetricsService();
    const worker = new ExportWorkerService(repository, generator, storage, config, metrics);

    await expect(worker.runOnce()).resolves.toBe(true);

    expect(complete).toHaveBeenCalledWith(
      { id: job.id, attempts: job.attempts },
      expect.any(String),
      expect.any(Date),
    );
    expect(write).toHaveBeenCalledWith(
      { id: job.id, attempts: job.attempts },
      job.format,
      new Uint8Array([1, 2, 3]),
    );
    expect(metrics.render()).toContain(
      'sigvits_export_jobs_total{outcome="completed",format="xlsx"} 1',
    );
    expect(worker.isReady(60_000)).toBe(true);
  });

  it('deletes expired artifacts after the grace period and clears their references', async () => {
    const clearArtifact = jest.fn().mockResolvedValue(true);
    const repository = {
      recoverStaleExhausted: jest.fn().mockResolvedValue(0),
      claimNext: jest.fn().mockResolvedValue(null),
      listExpiredArtifacts: jest.fn().mockResolvedValue([
        {
          jobId: job.id,
          storageKey: '11/11111111-1111-4111-8111-111111111111.xlsx',
          expiredAt: new Date('2026-08-25T00:00:00Z'),
        },
      ]),
      clearArtifact,
    } as unknown as ExportJobRepository;
    const deleteArtifact = jest.fn().mockResolvedValue(undefined);
    const storage = {
      delete: deleteArtifact,
    } as unknown as ExportArtifactStorage;
    const metrics = new MetricsService();
    const worker = new ExportWorkerService(
      repository,
      {} as ExportArtifactGenerator,
      storage,
      config,
      metrics,
    );

    await expect(worker.runOnce()).resolves.toBe(false);

    expect(deleteArtifact).toHaveBeenCalledTimes(1);
    expect(clearArtifact).toHaveBeenCalledWith(
      job.id,
      '11/11111111-1111-4111-8111-111111111111.xlsx',
    );
    expect(metrics.render()).toContain(
      'sigvits_export_artifact_cleanup_total{outcome="deleted"} 1',
    );
  });

  it('drains consecutive cleanup batches before polling the queue', async () => {
    const firstArtifact = {
      jobId: '11111111-1111-4111-8111-111111111111',
      storageKey: '11/first.xlsx',
      expiredAt: new Date('2026-08-24T00:00:00Z'),
    };
    const secondArtifact = {
      jobId: '22222222-2222-4222-8222-222222222222',
      storageKey: '22/second.xlsx',
      expiredAt: new Date('2026-08-25T00:00:00Z'),
    };
    const listExpiredArtifacts = jest
      .fn()
      .mockResolvedValueOnce([firstArtifact])
      .mockResolvedValueOnce([secondArtifact])
      .mockResolvedValueOnce([]);
    const clearArtifact = jest.fn().mockResolvedValue(true);
    const repository = {
      recoverStaleExhausted: jest.fn().mockResolvedValue(0),
      claimNext: jest.fn().mockResolvedValue(null),
      listExpiredArtifacts,
      clearArtifact,
    } as unknown as ExportJobRepository;
    const deleteArtifact = jest.fn().mockResolvedValue(undefined);
    const storage = {
      delete: deleteArtifact,
    } as unknown as ExportArtifactStorage;
    const metrics = new MetricsService();
    const worker = new ExportWorkerService(
      repository,
      {} as ExportArtifactGenerator,
      storage,
      { ...config, artifactCleanupBatchSize: 1 },
      metrics,
    );

    await expect(worker.runOnce()).resolves.toBe(false);

    expect(listExpiredArtifacts).toHaveBeenCalledTimes(3);
    expect(deleteArtifact).toHaveBeenCalledTimes(2);
    expect(clearArtifact).toHaveBeenCalledTimes(2);
    expect(metrics.render()).toContain('sigvits_export_artifact_cleanup_backlog 0');
  });

  it('records a failed generation without leaking its stack into the stored error code', async () => {
    const fail = jest.fn().mockResolvedValue(true);
    const repository = {
      recoverStaleExhausted: jest.fn().mockResolvedValue(0),
      claimNext: jest.fn().mockResolvedValue(job),
      fail,
      listExpiredArtifacts: jest.fn().mockResolvedValue([]),
    } as unknown as ExportJobRepository;
    const generator = {
      generate: jest.fn().mockRejectedValue(new Error('renderer failed: secret detail')),
    } as unknown as ExportArtifactGenerator;
    const metrics = new MetricsService();
    const worker = new ExportWorkerService(
      repository,
      generator,
      {} as ExportArtifactStorage,
      config,
      metrics,
    );

    await expect(worker.runOnce()).resolves.toBe(true);

    expect(fail).toHaveBeenCalledWith(
      { id: job.id, attempts: job.attempts },
      'EXPORT_GENERATION_FAILED',
    );
    expect(metrics.render()).toContain(
      'sigvits_export_jobs_total{outcome="failed",format="xlsx"} 1',
    );
  });

  it.each([false, true])(
    'discards only the superseded attempt artifact without failing the new claim (cleanup fails: %s)',
    async (cleanupFails) => {
      const repository = {
        recoverStaleExhausted: jest.fn().mockResolvedValue(0),
        claimNext: jest.fn().mockResolvedValue(job),
        complete: jest.fn().mockResolvedValue(false),
        fail: jest.fn(),
        listExpiredArtifacts: jest.fn().mockResolvedValue([]),
      };
      const ownStorageKey = `11/${job.id}.attempt-1.xlsx`;
      const storage = {
        write: jest.fn().mockResolvedValue(ownStorageKey),
        delete: cleanupFails
          ? jest.fn().mockRejectedValue(new Error('storage unavailable'))
          : jest.fn().mockResolvedValue(undefined),
      };
      const generator = { generate: jest.fn().mockResolvedValue(new Uint8Array([1])) };
      const metrics = new MetricsService();
      const worker = new ExportWorkerService(
        repository as unknown as ExportJobRepository,
        generator as unknown as ExportArtifactGenerator,
        storage as unknown as ExportArtifactStorage,
        config,
        metrics,
      );

      await expect(worker.runOnce()).resolves.toBe(true);

      expect(storage.delete).toHaveBeenCalledWith(ownStorageKey);
      expect(repository.fail).not.toHaveBeenCalled();
      expect(metrics.render()).not.toContain('outcome="completed"');
      expect(metrics.render()).not.toContain('sigvits_export_jobs_total{outcome="failed"');
      expect(worker.isReady(60_000)).toBe(true);
    },
  );

  it('ignores a generation failure from an attempt that has already been reclaimed', async () => {
    const repository = {
      recoverStaleExhausted: jest.fn().mockResolvedValue(0),
      claimNext: jest.fn().mockResolvedValue(job),
      fail: jest.fn().mockResolvedValue(false),
      listExpiredArtifacts: jest.fn().mockResolvedValue([]),
    };
    const generator = { generate: jest.fn().mockRejectedValue(new Error('stale renderer')) };
    const metrics = new MetricsService();
    const worker = new ExportWorkerService(
      repository as unknown as ExportJobRepository,
      generator as unknown as ExportArtifactGenerator,
      {} as ExportArtifactStorage,
      config,
      metrics,
    );

    await expect(worker.runOnce()).resolves.toBe(true);

    expect(repository.fail).toHaveBeenCalledWith(
      { id: job.id, attempts: 1 },
      'EXPORT_GENERATION_FAILED',
    );
    expect(metrics.render()).not.toContain('sigvits_export_jobs_total{outcome="failed"');
  });

  it.each([false, true])(
    'cleans up after an uncertain completion only if fail confirms it was not published (failed: %s)',
    async (failed) => {
      const repository = {
        recoverStaleExhausted: jest.fn().mockResolvedValue(0),
        claimNext: jest.fn().mockResolvedValue(job),
        complete: jest.fn().mockRejectedValue(new Error('connection lost after update')),
        fail: jest.fn().mockResolvedValue(failed),
        listExpiredArtifacts: jest.fn().mockResolvedValue([]),
      };
      const ownStorageKey = `11/${job.id}.attempt-1.xlsx`;
      const storage = {
        write: jest.fn().mockResolvedValue(ownStorageKey),
        delete: jest.fn().mockResolvedValue(undefined),
      };
      const generator = { generate: jest.fn().mockResolvedValue(new Uint8Array([1])) };
      const worker = new ExportWorkerService(
        repository as unknown as ExportJobRepository,
        generator as unknown as ExportArtifactGenerator,
        storage as unknown as ExportArtifactStorage,
        config,
        new MetricsService(),
      );

      await expect(worker.runOnce()).resolves.toBe(true);

      expect(repository.fail).toHaveBeenCalledWith(
        { id: job.id, attempts: 1 },
        'EXPORT_GENERATION_FAILED',
      );
      expect(storage.delete).toHaveBeenCalledTimes(failed ? 1 : 0);
    },
  );
});
