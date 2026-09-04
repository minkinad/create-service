import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { AppError } from '../src/lib/errors.js';
import { testConfig } from './helpers/config.js';

const apps: Awaited<ReturnType<typeof buildApp>>[] = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('HTTP API', () => {
  it('reports liveness and propagates a request id', async () => {
    const app = await buildApp({ config: testConfig });
    apps.push(app);
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'test-request-id' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('test-request-id');
    expect(response.json()).toMatchObject({ status: 'ok', service: 'test-service' });
  });

  it('returns 503 when a readiness dependency is down', async () => {
    const app = await buildApp({
      config: testConfig,
      readinessChecks: { database: () => Promise.reject(new Error('down')) },
    });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: 'not_ready', checks: { database: 'down' } });
  });

  it('validates input and returns a stable error contract', async () => {
    const app = await buildApp({ config: testConfig });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: `/api/v1/hello/${'a'.repeat(81)}` });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('returns a greeting from the example module', async () => {
    const app = await buildApp({ config: testConfig });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/api/v1/hello/World' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Hello, World!' });
  });

  it('returns stable responses for application and unknown errors', async () => {
    const app = await buildApp({ config: testConfig });
    apps.push(app);
    app.get('/test/conflict', async () => {
      throw new AppError('Already exists', 409, 'ALREADY_EXISTS', { resource: 'example' });
    });
    app.get('/test/failure', async () => {
      throw new Error('sensitive implementation detail');
    });

    const known = await app.inject({ method: 'GET', url: '/test/conflict' });
    const unknown = await app.inject({ method: 'GET', url: '/test/failure' });
    const missing = await app.inject({ method: 'GET', url: '/does-not-exist' });

    expect(known.statusCode).toBe(409);
    expect(known.json()).toMatchObject({
      error: { code: 'ALREADY_EXISTS', details: { resource: 'example' } },
    });
    expect(unknown.statusCode).toBe(500);
    expect(unknown.json<{ error: Record<string, unknown> }>().error).not.toHaveProperty('details');
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });

  it('exposes Prometheus metrics when enabled', async () => {
    const app = await buildApp({
      config: { ...testConfig, METRICS_ENABLED: true },
    });
    apps.push(app);
    await app.inject({ method: 'GET', url: '/health' });
    const response = await app.inject({ method: 'GET', url: '/metrics' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('service_http_requests_total');
    expect(response.body).toContain('service_process_cpu');
  });

  it('serves OpenAPI UI only when enabled', async () => {
    const app = await buildApp({ config: { ...testConfig, DOCS_ENABLED: true } });
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ info: Record<string, unknown> }>().info).toMatchObject({
      title: 'test-service',
      version: '1.0.0-test',
    });
  });

  it('disables CORS by default and supports an explicit allowlist', async () => {
    const restricted = await buildApp({
      config: { ...testConfig, CORS_ORIGINS: '' },
    });
    const allowlisted = await buildApp({
      config: { ...testConfig, CORS_ORIGINS: 'https://app.example.com' },
    });
    apps.push(restricted, allowlisted);

    const blocked = await restricted.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://unknown.example.com' },
    });
    const allowed = await allowlisted.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://app.example.com' },
    });

    expect(blocked.headers).not.toHaveProperty('access-control-allow-origin');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com');
  });
});
