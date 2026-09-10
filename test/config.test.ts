import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

describe('loadConfig', () => {
  it('coerces and validates environment values', () => {
    const config = loadConfig({ PORT: '8080', TRUST_PROXY: 'true' });

    expect(config.PORT).toBe(8080);
    expect(config.TRUST_PROXY).toBe(true);
  });

  it('fails fast with a useful message', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow('Invalid environment configuration');
  });

  it('does not expose API docs by default in production', () => {
    expect(loadConfig({ NODE_ENV: 'production' }).DOCS_ENABLED).toBe(false);
    expect(loadConfig({ NODE_ENV: 'production', DOCS_ENABLED: 'true' }).DOCS_ENABLED).toBe(true);
  });
});

describe('Configuration boundaries', () => {
  it('uses isolated defaults without reading unrelated process values', () => {
    expect(loadConfig({})).toMatchObject({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 3000,
      DOCS_ENABLED: true,
      METRICS_ENABLED: true,
      TRUST_PROXY: false,
      CORS_ORIGINS: '',
      READINESS_TIMEOUT_MS: 2000,
      SHUTDOWN_TIMEOUT_MS: 10000,
    });
  });

  it('normalizes and deduplicates explicit CORS origins', () => {
    expect(
      loadConfig({
        CORS_ORIGINS:
          ' https://app.example.com, ,https://other.example.com,https://app.example.com ',
      }).CORS_ORIGINS,
    ).toBe('https://app.example.com,https://other.example.com');
    expect(loadConfig({ CORS_ORIGINS: ' * ' }).CORS_ORIGINS).toBe('*');
    expect(loadConfig({ CORS_ORIGINS: ' , ' }).CORS_ORIGINS).toBe('');
  });

  it.each([
    { PORT: '0' },
    { PORT: '65536' },
    { PORT: '1.5' },
    { PORT: '' },
    { TRUST_PROXY: 'yes' },
    { METRICS_ENABLED: '1' },
    { DOCS_ENABLED: '' },
    { HOST: '  ' },
    { SERVICE_NAME: ' ' },
    { SERVICE_VERSION: '' },
    { NODE_ENV: 'staging' },
    { LOG_LEVEL: 'verbose' },
    { RATE_LIMIT_MAX: '0' },
    { RATE_LIMIT_MAX: 'Infinity' },
    { READINESS_TIMEOUT_MS: '-1' },
    { SHUTDOWN_TIMEOUT_MS: '2147483648' },
    { CORS_ORIGINS: '*,https://app.example.com' },
    { CORS_ORIGINS: 'https://app.example.com/path' },
    { CORS_ORIGINS: 'ftp://app.example.com' },
    { CORS_ORIGINS: 'not-a-url' },
  ])('rejects invalid settings: %j', (environment) => {
    expect(() => loadConfig(environment)).toThrow('Invalid environment configuration');
  });

  it('treats false as false and honors explicit documentation settings', () => {
    expect(
      loadConfig({ TRUST_PROXY: 'false', METRICS_ENABLED: 'false', DOCS_ENABLED: 'false' }),
    ).toMatchObject({ TRUST_PROXY: false, METRICS_ENABLED: false, DOCS_ENABLED: false });
  });

  it('reports all invalid variable names together', () => {
    expect(() => loadConfig({ PORT: '-1', READINESS_TIMEOUT_MS: '0' })).toThrow(
      /PORT:.*READINESS_TIMEOUT_MS:/,
    );
  });
});
