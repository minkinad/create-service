import type { FastifyInstance } from 'fastify';

export type ReadinessCheck = () => Promise<void>;

export interface HealthRouteOptions {
  serviceName: string;
  serviceVersion: string;
  readinessChecks?: Record<string, ReadinessCheck>;
}

const healthSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'service', 'version', 'timestamp'],
  properties: {
    status: { type: 'string' },
    service: { type: 'string' },
    version: { type: 'string' },
    timestamp: { type: 'string', format: 'date-time' },
    uptimeSeconds: { type: 'number' },
    checks: { type: 'object', additionalProperties: { type: 'string' } },
  },
} as const;

export async function healthRoutes(
  app: FastifyInstance,
  options: HealthRouteOptions,
): Promise<void> {
  app.get(
    '/health',
    {
      config: { rateLimit: false },
      schema: { tags: ['operations'], response: { 200: healthSchema } },
    },
    async () => ({
      status: 'ok',
      service: options.serviceName,
      version: options.serviceVersion,
      timestamp: new Date().toISOString(),
      uptimeSeconds: process.uptime(),
    }),
  );

  app.get(
    '/ready',
    { config: { rateLimit: false }, schema: { tags: ['operations'] } },
    async (_request, reply) => {
      const entries = Object.entries(options.readinessChecks ?? {});
      const results = await Promise.allSettled(entries.map(([, check]) => check()));
      const checks = Object.fromEntries(
        entries.map(([name], index) => [
          name,
          results[index]?.status === 'fulfilled' ? 'up' : 'down',
        ]),
      );
      const ready = results.every((result) => result.status === 'fulfilled');

      return reply.status(ready ? 200 : 503).send({
        status: ready ? 'ready' : 'not_ready',
        service: options.serviceName,
        version: options.serviceVersion,
        timestamp: new Date().toISOString(),
        checks,
      });
    },
  );
}
