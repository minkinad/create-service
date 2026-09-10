import type { FastifyInstance } from 'fastify';
import { Counter, Histogram, Registry, collectDefaultMetrics } from '@prometheus-io/client';

export async function registerMetrics(app: FastifyInstance): Promise<void> {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: 'service_' });

  const requests = new Counter({
    name: 'service_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
    registers: [registry],
  });
  const duration = new Histogram({
    name: 'service_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  app.decorateRequest('metricsStartedAt');
  app.addHook('onRequest', async (request) => {
    request.metricsStartedAt = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url ?? 'unknown';
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };
    requests.inc(labels);

    if (request.metricsStartedAt !== undefined) {
      const seconds = Number(process.hrtime.bigint() - request.metricsStartedAt) / 1e9;
      duration.observe(labels, seconds);
    }
  });

  app.addHook('onClose', async () => registry.clear());

  app.get(
    '/metrics',
    { config: { rateLimit: false }, schema: { hide: true } },
    async (_request, reply) => {
      return reply.header('content-type', registry.contentType).send(await registry.metrics());
    },
  );
}

declare module 'fastify' {
  interface FastifyRequest {
    metricsStartedAt?: bigint;
  }
}
