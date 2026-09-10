import { describe, expect, it, vi } from 'vitest';
import { createTestApp } from './helpers/app.js';

describe('Greeting module', () => {
  it('returns a greeting from the example module', async () => {
    const app = await createTestApp();
    const response = await app.inject('/api/v1/hello/World');

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ message: 'Hello, World!' });
  });

  it('passes decoded input to the supplied service', async () => {
    const greet = vi.fn((name: string) => ({ message: `Привет, ${name}!` }));
    const app = await createTestApp({ greetingService: { greet } });
    const response = await app.inject(`/api/v1/hello/${encodeURIComponent('Мир')}`);

    expect(greet).toHaveBeenCalledWith('Мир');
    expect(response.json()).toEqual({ message: 'Привет, Мир!' });
  });

  it('accepts a name at the length limit and rejects longer input before calling the service', async () => {
    const greet = vi.fn((name: string) => ({ message: name }));
    const app = await createTestApp({ greetingService: { greet } });
    const valid = await app.inject(`/api/v1/hello/${'a'.repeat(80)}`);
    const invalid = await app.inject(`/api/v1/hello/${'a'.repeat(81)}`);

    expect(valid.statusCode).toBe(200);
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    expect(greet).toHaveBeenCalledTimes(1);
  });
});
