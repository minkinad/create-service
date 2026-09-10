import type { FastifyError, FastifyInstance } from 'fastify';
import { errorResponse } from '../lib/error-response.js';
import { AppError } from '../lib/errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send(errorResponse(request.id, 'NOT_FOUND', 'Route not found'));
  });

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, 'Application error');
      return reply
        .status(error.statusCode)
        .send(errorResponse(request.id, error.code, error.message, error.details));
    }

    if (error.validation !== undefined) {
      return reply.status(400).send(errorResponse(request.id, 'VALIDATION_ERROR', error.message));
    }

    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
      return reply
        .status(error.statusCode)
        .send(errorResponse(request.id, error.code ?? 'HTTP_ERROR', error.message));
    }

    request.log.error({ err: error }, 'Unhandled request error');
    return reply
      .status(500)
      .send(errorResponse(request.id, 'INTERNAL_ERROR', 'Internal server error'));
  });
}
