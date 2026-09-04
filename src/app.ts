import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { type AppConfig, loadConfig } from './config/env.js';
import { greetingRoutes } from './modules/greeting/greeting.routes.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerMetrics } from './plugins/metrics.js';
import { healthRoutes, type ReadinessCheck } from './routes/health.js';

export interface BuildAppOptions {
  config?: AppConfig;
  readinessChecks?: Record<string, ReadinessCheck>;
}

function requestId(request: IncomingMessage): string {
  const incoming = request.headers['x-request-id'];
  return typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID();
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    requestIdHeader: false,
    genReqId: requestId,
    logger: {
      level: config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
  });

  registerErrorHandler(app);

  app.addHook('onRequest', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });

  await app.register(helmet);
  await app.register(cors, {
    origin:
      config.CORS_ORIGINS === '*'
        ? '*'
        : config.CORS_ORIGINS.length === 0
          ? false
          : config.CORS_ORIGINS.split(',').map((value) => value.trim()),
  });
  await app.register(rateLimit, { max: config.RATE_LIMIT_MAX, timeWindow: '1 minute' });
  await app.register(swagger, {
    openapi: {
      info: {
        title: config.SERVICE_NAME,
        description: 'HTTP API documentation',
        version: config.SERVICE_VERSION,
      },
    },
  });

  if (config.DOCS_ENABLED) {
    await app.register(swaggerUi, { routePrefix: '/docs' });
  }

  if (config.METRICS_ENABLED) {
    await registerMetrics(app);
  }

  await app.register(healthRoutes, {
    serviceName: config.SERVICE_NAME,
    serviceVersion: config.SERVICE_VERSION,
    ...(options.readinessChecks === undefined ? {} : { readinessChecks: options.readinessChecks }),
  });
  await app.register(greetingRoutes, { prefix: '/api/v1' });

  return app;
}
