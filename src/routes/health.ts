import type { FastifyInstance } from 'fastify';
import { checkReadiness, type ReadinessCheck } from '../lib/readiness.js';

export type { ReadinessCheck } from '../lib/readiness.js';

export interface HealthRouteOptions {
  serviceName: string;
  serviceVersion: string;
  readinessChecks?: Record<string, ReadinessCheck>;
  readinessTimeoutMs?: number;
}

const serviceProperties = {
  service: { type: 'string' },
  version: { type: 'string' },
  timestamp: { type: 'string', format: 'date-time' },
} as const;

const healthSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'service', 'version', 'timestamp', 'uptimeSeconds'],
  properties: {
    ...serviceProperties,
    status: { type: 'string', enum: ['ok'] },
    uptimeSeconds: { type: 'number' },
  },
} as const;

const readinessSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'service', 'version', 'timestamp', 'checks'],
  properties: {
    ...serviceProperties,
    status: { type: 'string', enum: ['ready', 'not_ready'] },
    checks: { type: 'object', additionalProperties: { type: 'string', enum: ['up', 'down'] } },
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
    {
      config: { rateLimit: false },
      schema: { tags: ['operations'], response: { 200: readinessSchema, 503: readinessSchema } },
    },
    async (_request, reply) => {
      const checks = await checkReadiness(
        options.readinessChecks ?? {},
        options.readinessTimeoutMs ?? 2_000,
      );
      const ready = Object.values(checks).every((status) => status === 'up');

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
