import { describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app.js';
import { testConfig } from './helpers/config.js';

describe('Observability', () => {
  it('keeps metrics and documentation routes unavailable when disabled', async () => {
    const app = await createTestApp();
    for (const path of ['/metrics', '/docs/', '/docs/json', '/docs/yaml']) {
      expect((await app.inject(path)).statusCode).toBe(404);
    }
  });

  it('documents business responses', async () => {
    const app = await createTestApp({
      config: { ...testConfig, DOCS_ENABLED: true, METRICS_ENABLED: true },
    });
    const response = await app.inject('/docs/json');
    expect(response.statusCode).toBe(200);
    const document = response.json<{
      info: object;
      paths: Record<string, { get: { responses: Record<string, unknown> } }>;
    }>();
    expect(document.info).toMatchObject({ title: 'test-service', version: '1.0.0-test' });
    expect(document.paths['/api/v1/hello/{name}']?.get.responses).toHaveProperty('4XX');
    expect(document.paths['/api/v1/hello/{name}']?.get.responses).toHaveProperty('5XX');
    expect(document.paths).not.toHaveProperty('/metrics');
    const ui = await app.inject('/docs/');
    expect(ui.statusCode).toBe(200);
    expect(ui.headers['content-type']).toContain('text/html');
    expect(ui.headers['content-security-policy']).toBeDefined();
  });

  it('measures rejected requests and groups URLs by route pattern', async () => {
    const app = await createTestApp({
      config: { ...testConfig, METRICS_ENABLED: true, RATE_LIMIT_MAX: 1 },
    });
    await app.inject('/api/v1/hello/Alice');
    await app.inject('/api/v1/hello/Bob');
    await app.inject('/unknown-one');
    await app.inject('/unknown-two');
    const response = await app.inject('/metrics');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('service_process_cpu');
    expect(response.body).toContain(
      'service_http_requests_total{method="GET",route="/api/v1/hello/:name",status_code="200"} 1',
    );
    expect(response.body).toContain(
      'service_http_request_duration_seconds_count{method="GET",route="/api/v1/hello/:name",status_code="429"} 1',
    );
    expect(response.body).toContain('route="unknown",status_code="404"} 2');
    expect(response.body).not.toContain('Alice');
    expect(response.body).not.toContain('unknown-one');
  });

  it('isolates registries between application instances', async () => {
    const first = await createTestApp({ config: { ...testConfig, METRICS_ENABLED: true } });
    const second = await createTestApp({ config: { ...testConfig, METRICS_ENABLED: true } });
    await first.inject('/api/v1/hello/World');
    const metrics = await second.inject('/metrics');
    expect(metrics.body).not.toContain('route="/api/v1/hello/:name"');
  });
});
