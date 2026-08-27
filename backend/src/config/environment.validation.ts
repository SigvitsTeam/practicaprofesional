import Joi from 'joi';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string()
    .pattern(/^[a-z][a-z0-9-]*$/)
    .default('api'),
  DATABASE_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri({ scheme: ['postgresql', 'postgres'] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['postgresql', 'postgres'] })
      .optional(),
  }),
  DIRECT_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .optional(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).max(100).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: Joi.number().integer().min(100).max(60_000).default(5_000),
  DATABASE_IDLE_TIMEOUT_MS: Joi.number().integer().min(1_000).max(600_000).default(30_000),
  AUTH_ISSUER: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['https', 'http'] })
      .optional(),
  }),
  AUTH_AUDIENCE: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(1).max(200).required(),
    otherwise: Joi.string().min(1).max(200).optional(),
  }),
  AUTH_JWKS_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['https', 'http'] })
      .optional(),
  }),
  AUTH_CLOCK_TOLERANCE_SECONDS: Joi.number().integer().min(0).max(60).default(5),
  AUTH_JWKS_TIMEOUT_MS: Joi.number().integer().min(500).max(30_000).default(5_000),
  AUTH_ADMIN_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(20).max(4096).required(),
    otherwise: Joi.string().min(20).max(4096).optional(),
  }),
  AUTH_INVITATION_REDIRECT_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string()
      .uri({ scheme: ['https'] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['https', 'http'] })
      .optional(),
  }),
  AUTH_ADMIN_TIMEOUT_MS: Joi.number().integer().min(500).max(30_000).default(5_000),
  EXPORT_STORAGE_DIRECTORY: Joi.string().min(1).max(500).default('.data/exports'),
  EXPORT_WORKER_POLL_MS: Joi.number().integer().min(250).max(60_000).default(2_000),
  EXPORT_JOB_STALE_MS: Joi.number().integer().min(60_000).max(86_400_000).default(900_000),
  EXPORT_ARTIFACT_TTL_MS: Joi.number().integer().min(60_000).max(604_800_000).default(86_400_000),
  EXPORT_ARTIFACT_CLEANUP_INTERVAL_MS: Joi.number()
    .integer()
    .min(10_000)
    .max(86_400_000)
    .default(900_000),
  EXPORT_ARTIFACT_CLEANUP_GRACE_MS: Joi.number()
    .integer()
    .min(10_000)
    .max(86_400_000)
    .default(300_000),
  EXPORT_ARTIFACT_CLEANUP_BATCH_SIZE: Joi.number().integer().min(1).max(1_000).default(100),
  EXPORT_WORKER_MAX_BACKOFF_MS: Joi.number().integer().min(1_000).max(300_000).default(30_000),
  EXPORT_WORKER_HEALTH_PORT: Joi.number().port().default(3_001),
  EXPORT_WORKER_HEALTH_HOST: Joi.alternatives()
    .try(Joi.string().hostname(), Joi.string().ip())
    .default('0.0.0.0'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),
  REQUEST_BODY_LIMIT: Joi.string()
    .pattern(/^\d+(b|kb|mb)$/i)
    .default('100kb'),
  THROTTLE_TTL_MS: Joi.number().integer().min(1_000).default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(0),
  METRICS_BEARER_TOKEN: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).max(512).required(),
    otherwise: Joi.string().min(16).max(512).optional(),
  }),
  HTTP_REQUEST_TIMEOUT_MS: Joi.number().integer().min(1_000).max(300_000).default(30_000),
  HTTP_HEADERS_TIMEOUT_MS: Joi.number().integer().min(2_000).max(310_000).default(35_000),
  HTTP_KEEP_ALIVE_TIMEOUT_MS: Joi.number().integer().min(1_000).max(120_000).default(5_000),
  HTTP_MAX_REQUESTS_PER_SOCKET: Joi.number().integer().min(1).max(100_000).default(1_000),
  READINESS_TIMEOUT_MS: Joi.number().integer().min(100).max(30_000).default(3_000),
}).unknown(true);
