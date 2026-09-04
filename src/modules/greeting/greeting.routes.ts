import type { FastifyInstance } from 'fastify';
import { GreetingService } from './greeting.service.js';

interface GreetingParams {
  name: string;
}

const greetingResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['message'],
  properties: { message: { type: 'string' } },
} as const;

export async function greetingRoutes(app: FastifyInstance): Promise<void> {
  const service = new GreetingService();

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
        response: { 200: greetingResponseSchema },
      },
    },
    async (request) => service.greet(request.params.name),
  );
}
