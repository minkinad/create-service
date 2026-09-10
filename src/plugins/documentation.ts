import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config/env.js';

export async function registerDocumentation(
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> {
  if (!config.DOCS_ENABLED) return;

  await app.register(swagger, {
    openapi: {
      info: {
        title: config.SERVICE_NAME,
        description: 'HTTP API documentation',
        version: config.SERVICE_VERSION,
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs', staticCSP: true });
}
