import type { AppConfig } from '../../src/config/env.js';

export const testConfig: AppConfig = {
  NODE_ENV: 'test',
  HOST: '127.0.0.1',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  SERVICE_NAME: 'test-service',
  SERVICE_VERSION: '1.0.0-test',
  CORS_ORIGINS: '*',
  TRUST_PROXY: false,
  DOCS_ENABLED: false,
  METRICS_ENABLED: false,
  RATE_LIMIT_MAX: 100,
  READINESS_TIMEOUT_MS: 100,
  SHUTDOWN_TIMEOUT_MS: 1000,
};
