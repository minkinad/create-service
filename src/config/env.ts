import { z } from 'zod';

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SERVICE_NAME: z.string().min(1).default('my-service'),
    SERVICE_VERSION: z.string().min(1).default('0.0.0'),
    CORS_ORIGINS: z.string().default(''),
    TRUST_PROXY: booleanFromString.default(false),
    DOCS_ENABLED: booleanFromString.optional(),
    METRICS_ENABLED: booleanFromString.default(true),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  })
  .transform((config) => ({
    ...config,
    DOCS_ENABLED: config.DOCS_ENABLED ?? config.NODE_ENV !== 'production',
  }));

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(environment);

  if (!result.success) {
    const issues = result.error.issues
      .map(({ path, message }) => `${path.join('.')}: ${message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
}
