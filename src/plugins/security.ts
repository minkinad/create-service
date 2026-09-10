import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config/env.js';
import { AppError } from '../lib/errors.js';

export async function registerSecurity(app: FastifyInstance, config: AppConfig): Promise<void> {
  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGINS === '*' ? '*' : config.CORS_ORIGINS.split(',').filter(Boolean),
    exposedHeaders: ['x-request-id'],
  });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_request, context) =>
      new AppError(
        `Rate limit exceeded, retry in ${context.after}`,
        context.statusCode,
        'RATE_LIMIT_EXCEEDED',
      ),
  });
}
