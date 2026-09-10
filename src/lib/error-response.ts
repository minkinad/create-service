export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export function errorResponse(
  requestId: string,
  code: string,
  message: string,
  details?: unknown,
): ErrorResponse {
  return { error: { code, message, requestId, ...(details === undefined ? {} : { details }) } };
}

export const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'message', 'requestId'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
        details: {},
      },
    },
  },
} as const;
