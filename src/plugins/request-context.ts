import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { FastifyInstance, FastifyServerOptions } from 'fastify';
import type { AppConfig } from '../config/env.js';

export function requestId(request: IncomingMessage): string {
  const incoming = request.headers['x-request-id'];
  return typeof incoming === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(incoming)
    ? incoming
    : randomUUID();
}

export function loggerOptions(
  config: AppConfig,
): Exclude<FastifyServerOptions['logger'], boolean | undefined> {
  return {
    level: config.LOG_LEVEL,
    base: { service: config.SERVICE_NAME, version: config.SERVICE_VERSION },
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  };
}

export function registerRequestContext(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    void reply.header('x-request-id', request.id);
  });
}
