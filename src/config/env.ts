import { z } from 'zod';

const booleanFromString = z.enum(['true', 'false']).transform((value) => value === 'true');
const timeoutMs = z.coerce.number().int().positive().max(2_147_483_647);
const corsOrigins = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
  .refine(
    (origins) =>
      (origins.length === 1 && origins[0] === '*') ||
      origins.every((origin) => {
        try {
          const url = new URL(origin);
          return ['http:', 'https:'].includes(url.protocol) && url.origin === origin;
        } catch {
          return false;
        }
      }),
    'Use * alone or comma-separated HTTP(S) origins without paths',
  )
  .transform((origins) => [...new Set(origins)].join(','));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().trim().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    SERVICE_NAME: z.string().trim().min(1).default('my-service'),
    SERVICE_VERSION: z.string().trim().min(1).default('0.0.0'),
    CORS_ORIGINS: corsOrigins,
    TRUST_PROXY: booleanFromString.default(false),
    DOCS_ENABLED: booleanFromString.optional(),
    METRICS_ENABLED: booleanFromString.default(true),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().safe().default(100),
    READINESS_TIMEOUT_MS: timeoutMs.default(2_000),
    SHUTDOWN_TIMEOUT_MS: timeoutMs.default(10_000),
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
