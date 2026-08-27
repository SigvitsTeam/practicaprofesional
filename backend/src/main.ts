import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import type { Server } from 'node:http';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    abortOnError: true,
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const apiPrefix = config.getOrThrow<string>('app.apiPrefix');
  const bodyLimit = config.getOrThrow<string>('app.requestBodyLimit');
  const trustProxyHops = config.getOrThrow<number>('app.trustProxyHops');

  app.set('trust proxy', trustProxyHops);
  app.use(helmet());
  app.use(json({ limit: bodyLimit, strict: true, type: 'application/json' }));
  app.use(urlencoded({ extended: false, limit: bodyLimit }));
  app.enableCors({
    origin: config.getOrThrow<string[]>('app.corsOrigins'),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    credentials: true,
    maxAge: 600,
  });
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();

  const server: Server = app.getHttpServer();
  server.requestTimeout = config.getOrThrow<number>('app.requestTimeoutMs');
  server.headersTimeout = config.getOrThrow<number>('app.headersTimeoutMs');
  server.keepAliveTimeout = config.getOrThrow<number>('app.keepAliveTimeoutMs');
  server.maxRequestsPerSocket = config.getOrThrow<number>('app.maxRequestsPerSocket');

  const port = config.getOrThrow<number>('app.port');
  await app.listen(port, '0.0.0.0');
  Logger.log(`SIGVITS API listening on port ${port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error('SIGVITS API failed to start', error instanceof Error ? error.stack : undefined);
  process.exitCode = 1;
});
