import type { FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors.js';

interface ValidationError {
  validation?: unknown;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Request validation failed';
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: request.id,
      },
    });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: getErrorMessage(error),
          requestId: request.id,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
    }

    if ((error as ValidationError).validation !== undefined) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: getErrorMessage(error),
          requestId: request.id,
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply.status(500).send({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: request.id,
      },
    });
  });
}
