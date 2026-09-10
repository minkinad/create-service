import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { testConfig } from './helpers/config.js';

describe('Health routes', () => {
  it('reports liveness without calling dependencies', async () => {
    const database = vi.fn(() => Promise.reject(new Error('private connection string')));
    const app = await createTestApp({ readinessChecks: { database } });
    const response = await app.inject('/health');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'test-service',
      version: '1.0.0-test',
    });
    const body = response.json<{ timestamp: string; uptimeSeconds: number }>();
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(database).not.toHaveBeenCalled();
  });

  it('is ready when no dependencies are configured', async () => {
    const app = await createTestApp();
    const response = await app.inject('/ready');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ready', checks: {} });
  });

  it('reports successful synchronous and asynchronous checks', async () => {
    const app = await createTestApp({
      readinessChecks: { cache: () => {}, database: async () => {} },
    });
    const response = await app.inject('/ready');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ready',
      checks: { cache: 'up', database: 'up' },
    });
  });

  it('isolates synchronous throws and rejected promises, without exposing failure details', async () => {
    const app = await createTestApp({
      readinessChecks: {
        cache: () => {},
        database: () => Promise.reject(new Error('private connection string')),
        broker: () => {
          throw new Error('secret');
        },
      },
    });
    const response = await app.inject('/ready');

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({
      status: 'not_ready',
      checks: { cache: 'up', database: 'down', broker: 'down' },
    });
    expect(response.body).not.toContain('secret');
    expect(response.body).not.toContain('private');
  });

  it('returns 503 for a hanging dependency and sends it an abort signal', async () => {
    let signal: AbortSignal | undefined;
    const app = await createTestApp({
      config: { ...testConfig, READINESS_TIMEOUT_MS: 20 },
      readinessChecks: {
        database: (abortSignal) => {
          signal = abortSignal;
          return new Promise<void>(() => {});
        },
      },
    });
    const response = await app.inject('/ready');
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ checks: { database: 'down' } });
    expect(signal?.aborted).toBe(true);
  });
});
