import { describe, expect, it } from 'vitest';
import { AppError } from '../src/lib/errors.js';
import { createTestApp } from './helpers/app.js';

describe('Error contract', () => {
  it('returns application errors with optional public details', async () => {
    const app = await createTestApp();
    app.get('/conflict', async () => {
      throw new AppError('Already exists', 409, 'ALREADY_EXISTS', { resource: 'example' });
    });
    app.get('/unavailable', async () => {
      throw new AppError('Temporarily unavailable', 503, 'UNAVAILABLE');
    });
    const conflict = await app.inject({
      url: '/conflict',
      headers: { 'x-request-id': 'error-id' },
    });
    const unavailable = await app.inject('/unavailable');

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      error: {
        code: 'ALREADY_EXISTS',
        message: 'Already exists',
        requestId: 'error-id',
        details: { resource: 'example' },
      },
    });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toMatchObject({
      error: { code: 'UNAVAILABLE', message: 'Temporarily unavailable' },
    });
    expect(unavailable.json<{ error: object }>().error).not.toHaveProperty('details');
  });

  it('hides unknown server errors, including errors with a 5xx status', async () => {
    const app = await createTestApp();
    app.get('/failure', async () => {
      throw Object.assign(new Error('sensitive implementation detail'), { statusCode: 502 });
    });
    const response = await app.inject('/failure');
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: response.headers['x-request-id'],
      },
    });
  });

  it('uses the same contract for missing routes', async () => {
    const app = await createTestApp();
    const response = await app.inject('/does-not-exist');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
        requestId: response.headers['x-request-id'],
      },
    });
  });

  it.each([
    ['application/json', '{', 400, 'FST_ERR_CTP_INVALID_JSON_BODY'],
    ['application/xml', '<xml/>', 415, 'FST_ERR_CTP_INVALID_MEDIA_TYPE'],
    [
      'application/json',
      JSON.stringify({ value: 'x'.repeat(1_048_576) }),
      413,
      'FST_ERR_CTP_BODY_TOO_LARGE',
    ],
  ])('preserves parser errors (case %#)', async (contentType, payload, statusCode, code) => {
    const app = await createTestApp();
    app.post('/echo', async (request) => request.body);
    const response = await app.inject({
      method: 'POST',
      url: '/echo',
      headers: { 'content-type': contentType },
      payload,
    });
    expect(response.statusCode).toBe(statusCode);
    expect(response.json()).toMatchObject({
      error: { code, requestId: response.headers['x-request-id'] },
    });
  });

  it('preserves client HTTP errors without a framework code', async () => {
    const app = await createTestApp();
    app.get('/forbidden', async () => {
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    });
    const response = await app.inject('/forbidden');
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: 'HTTP_ERROR', message: 'Forbidden' } });
  });

  it.each([200, 399, 600, 400.5, NaN])(
    'rejects invalid application error status %s',
    (statusCode) => {
      expect(() => new AppError('Invalid', statusCode, 'INVALID')).toThrow(RangeError);
    },
  );
});
