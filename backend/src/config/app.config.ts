import { registerAs } from '@nestjs/config';

function parseOrigins(value: string | undefined): string[] {
  return (value ?? 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigins: parseOrigins(process.env.CORS_ORIGINS),
  requestBodyLimit: process.env.REQUEST_BODY_LIMIT ?? '100kb',
  throttleTtlMs: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
  throttleLimit: Number(process.env.THROTTLE_LIMIT ?? 100),
  trustProxy: process.env.TRUST_PROXY === 'true',
}));

export type AppConfig = ReturnType<typeof appConfig>;
