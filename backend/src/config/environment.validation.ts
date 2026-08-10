import Joi from 'joi';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string()
    .pattern(/^[a-z][a-z0-9-]*$/)
    .default('api'),
  CORS_ORIGINS: Joi.string().default('http://localhost:4200'),
  REQUEST_BODY_LIMIT: Joi.string()
    .pattern(/^\d+(b|kb|mb)$/i)
    .default('100kb'),
  THROTTLE_TTL_MS: Joi.number().integer().min(1_000).default(60_000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  TRUST_PROXY: Joi.boolean().truthy('true').falsy('false').default(false),
}).unknown(true);
