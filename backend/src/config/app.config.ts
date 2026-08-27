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
  trustProxyHops: Number(
    process.env.TRUST_PROXY_HOPS ?? (process.env.TRUST_PROXY === 'true' ? 1 : 0),
  ),
  metricsBearerToken: process.env.METRICS_BEARER_TOKEN,
  requestTimeoutMs: Number(process.env.HTTP_REQUEST_TIMEOUT_MS ?? 30_000),
  headersTimeoutMs: Number(process.env.HTTP_HEADERS_TIMEOUT_MS ?? 35_000),
  keepAliveTimeoutMs: Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS ?? 5_000),
  maxRequestsPerSocket: Number(process.env.HTTP_MAX_REQUESTS_PER_SOCKET ?? 1_000),
  readinessTimeoutMs: Number(process.env.READINESS_TIMEOUT_MS ?? 3_000),
}));

export type AppConfig = ReturnType<typeof appConfig>;

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
  connectionTimeoutMs: Number(process.env.DATABASE_CONNECTION_TIMEOUT_MS ?? 5_000),
  idleTimeoutMs: Number(process.env.DATABASE_IDLE_TIMEOUT_MS ?? 30_000),
}));

export const authConfig = registerAs('auth', () => ({
  issuer: process.env.AUTH_ISSUER,
  audience: process.env.AUTH_AUDIENCE,
  jwksUrl: process.env.AUTH_JWKS_URL,
  clockToleranceSeconds: Number(process.env.AUTH_CLOCK_TOLERANCE_SECONDS ?? 5),
  jwksTimeoutMs: Number(process.env.AUTH_JWKS_TIMEOUT_MS ?? 5_000),
  adminSecret: process.env.AUTH_ADMIN_SECRET,
  invitationRedirectUrl: process.env.AUTH_INVITATION_REDIRECT_URL,
  adminTimeoutMs: Number(process.env.AUTH_ADMIN_TIMEOUT_MS ?? 5_000),
}));

export const exportConfig = registerAs('exports', () => ({
  storageDirectory: process.env.EXPORT_STORAGE_DIRECTORY ?? '.data/exports',
  workerPollMs: Number(process.env.EXPORT_WORKER_POLL_MS ?? 2_000),
  staleAfterMs: Number(process.env.EXPORT_JOB_STALE_MS ?? 15 * 60_000),
  artifactTtlMs: Number(process.env.EXPORT_ARTIFACT_TTL_MS ?? 24 * 60 * 60_000),
  artifactCleanupIntervalMs: Number(process.env.EXPORT_ARTIFACT_CLEANUP_INTERVAL_MS ?? 15 * 60_000),
  artifactCleanupGraceMs: Number(process.env.EXPORT_ARTIFACT_CLEANUP_GRACE_MS ?? 5 * 60_000),
  artifactCleanupBatchSize: Number(process.env.EXPORT_ARTIFACT_CLEANUP_BATCH_SIZE ?? 100),
  workerMaxBackoffMs: Number(process.env.EXPORT_WORKER_MAX_BACKOFF_MS ?? 30_000),
  workerHealthPort: Number(process.env.EXPORT_WORKER_HEALTH_PORT ?? 3_001),
  workerHealthHost: process.env.EXPORT_WORKER_HEALTH_HOST ?? '0.0.0.0',
}));

export type ExportConfig = ReturnType<typeof exportConfig>;
