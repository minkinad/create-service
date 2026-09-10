import type { FastifyInstance } from 'fastify';
import { errorResponseSchema } from '../../lib/error-response.js';
import type { GreetingService } from './greeting.service.js';

interface GreetingParams {
  name: string;
}

const greetingResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: { message: { type: 'string' } },
} as const;

interface GreetingRouteOptions {
  service: Pick<GreetingService, 'greet'>;
}

export async function greetingRoutes(
  app: FastifyInstance,
  { service }: GreetingRouteOptions,
): Promise<void> {
  app.get<{ Params: GreetingParams }>(
    '/hello/:name',
    {
      schema: {
        tags: ['example'],
        summary: 'Return a personalized greeting',
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1, maxLength: 80 } },
        },
        response: {
          200: greetingResponseSchema,
          '4xx': errorResponseSchema,
          '5xx': errorResponseSchema,
        },
      },
    },
    async (request) => service.greet(request.params.name),
  );
}
