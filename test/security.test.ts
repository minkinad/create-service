import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { testConfig } from './helpers/config.js';

describe('HTTP security and request context', () => {
  it('propagates a valid request id and sends security headers', async () => {
    const app = await createTestApp();
    const response = await app.inject({
      url: '/health',
      headers: { 'x-request-id': 'trace:123_test-abc.0' },
    });
    expect(response.headers['x-request-id']).toBe('trace:123_test-abc.0');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it.each(['', 'a'.repeat(129), 'id with spaces', '<script>'])(
    'replaces an invalid request id (%j)',
    async (id) => {
      const app = await createTestApp();
      const response = await app.inject({ url: '/health', headers: { 'x-request-id': id } });
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    },
  );

  it('generates distinct request ids when none is supplied', async () => {
    const app = await createTestApp();
    const first = await app.inject('/health');
    const second = await app.inject('/health');
    expect(first.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.headers['x-request-id']).not.toBe(second.headers['x-request-id']);
  });

  it('does not grant CORS access when disabled or when the origin is outside the allowlist', async () => {
    for (const origins of ['', 'https://app.example.com']) {
      const app = await createTestApp({ config: { ...testConfig, CORS_ORIGINS: origins } });
      const response = await app.inject({
        url: '/health',
        headers: { origin: 'https://unknown.example.com' },
      });
      expect(response.headers).not.toHaveProperty('access-control-allow-origin');
    }
  });

  it.each(['*', 'https://app.example.com,https://other.example.com'])(
    'supports CORS %s and exposes request ids to browsers',
    async (origins) => {
      const app = await createTestApp({ config: { ...testConfig, CORS_ORIGINS: origins } });
      const response = await app.inject({
        url: '/health',
        headers: { origin: 'https://app.example.com' },
      });
      expect(response.headers['access-control-allow-origin']).toBe(
        origins === '*' ? '*' : 'https://app.example.com',
      );
      expect(response.headers['access-control-expose-headers']).toBe('x-request-id');
      const preflight = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/hello/World',
        headers: { origin: 'https://app.example.com', 'access-control-request-method': 'GET' },
      });
      expect(preflight.statusCode).toBe(204);
    },
  );

  it('returns 429 with retry headers while keeping operational endpoints available', async () => {
    const app = await createTestApp({
      config: { ...testConfig, RATE_LIMIT_MAX: 1, METRICS_ENABLED: true },
    });
    expect((await app.inject('/api/v1/hello/World')).statusCode).toBe(200);
    const limited = await app.inject('/api/v1/hello/World');
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({
      error: { code: 'RATE_LIMIT_EXCEEDED', requestId: limited.headers['x-request-id'] },
    });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    for (const path of ['/health', '/ready', '/metrics']) {
      expect((await app.inject(path)).statusCode).toBe(200);
      expect((await app.inject(path)).statusCode).toBe(200);
    }
  });

  it.each([false, true])('uses proxy headers only when TRUST_PROXY=%s', async (trustProxy) => {
    const app = await createTestApp({
      config: { ...testConfig, TRUST_PROXY: trustProxy, RATE_LIMIT_MAX: 1 },
    });
    await app.inject({ url: '/api/v1/hello/World', headers: { 'x-forwarded-for': '192.0.2.1' } });
    const second = await app.inject({
      url: '/api/v1/hello/World',
      headers: { 'x-forwarded-for': '192.0.2.2' },
    });
    expect(second.statusCode).toBe(trustProxy ? 200 : 429);
  });
});
