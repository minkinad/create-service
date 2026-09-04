import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/env.js';

describe('loadConfig', () => {
  it('coerces and validates environment values', () => {
    const config = loadConfig({ PORT: '8080', TRUST_PROXY: 'true' });

    expect(config.PORT).toBe(8080);
    expect(config.TRUST_PROXY).toBe(true);
  });

  it('fails fast with a useful message', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow('Invalid environment configuration');
  });

  it('does not expose API docs by default in production', () => {
    expect(loadConfig({ NODE_ENV: 'production' }).DOCS_ENABLED).toBe(false);
    expect(loadConfig({ NODE_ENV: 'production', DOCS_ENABLED: 'true' }).DOCS_ENABLED).toBe(true);
  });
});
