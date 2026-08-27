import { Logger } from '@nestjs/common';
import { ConfigService, type ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { setTimeout as wait } from 'node:timers/promises';
import { AppModule } from './app.module';
import { MetricsService } from './common/observability/metrics.service';
import { WorkerProbeServer } from './common/observability/worker-probe.server';
import { exportConfig } from './config/app.config';
import { ExportWorkerService } from './modules/exports/application/export-worker.service';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const worker = application.get(ExportWorkerService);
  const config = application.get<ConfigType<typeof exportConfig>>(exportConfig.KEY);
  const configService = application.get(ConfigService);
  const metrics = application.get(MetricsService);
  const logger = new Logger('ExportWorker');
  let stopping = false;
  const stopController = new AbortController();
  const stop = (): void => {
    stopping = true;
    worker.recordStopping();
    stopController.abort();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const readinessMaxAgeMs = Math.max(10_000, config.workerPollMs * 3);
  const probes = new WorkerProbeServer(metrics, {
    host: config.workerHealthHost,
    port: config.workerHealthPort,
    bearerToken: configService.get<string>('app.metricsBearerToken'),
    isReady: (): boolean => !stopping && worker.isReady(readinessMaxAgeMs),
  });
  await probes.start();
  logger.log(`Export worker started probePort=${config.workerHealthPort}`);
  let consecutiveFailures = 0;
  try {
    while (!stopping) {
      try {
        const processed = await worker.runOnce();
        consecutiveFailures = 0;
        if (!processed)
          await wait(config.workerPollMs, undefined, { signal: stopController.signal });
      } catch (error: unknown) {
        if (stopping) break;
        worker.recordPollFailure();
        consecutiveFailures += 1;
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        logger.error(
          `Export queue poll failed error=${errorName} consecutiveFailures=${consecutiveFailures}`,
        );
        const backoffMs = Math.min(
          config.workerMaxBackoffMs,
          config.workerPollMs * 2 ** Math.min(consecutiveFailures - 1, 8),
        );
        await wait(backoffMs, undefined, { signal: stopController.signal });
      }
    }
  } catch (error: unknown) {
    if (!(error instanceof Error && error.name === 'AbortError')) throw error;
  } finally {
    await probes.stop();
    await application.close();
  }
  logger.log('Export worker stopped');
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected export worker failure';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
