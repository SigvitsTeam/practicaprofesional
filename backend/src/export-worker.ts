import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { exportConfig } from './config/app.config';
import { ExportWorkerService } from './modules/exports/application/export-worker.service';

async function bootstrap(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const worker = application.get(ExportWorkerService);
  const config = application.get<ConfigType<typeof exportConfig>>(exportConfig.KEY);
  const logger = new Logger('ExportWorker');
  let stopping = false;
  const stop = (): void => {
    stopping = true;
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  logger.log('Export worker started');
  while (!stopping) {
    const processed = await worker.runOnce();
    if (!processed) await new Promise<void>((resolve) => setTimeout(resolve, config.workerPollMs));
  }
  await application.close();
  logger.log('Export worker stopped');
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected export worker failure';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
