import { onTestFinished } from 'vitest';
import { buildApp, type BuildAppOptions } from '../../src/app.js';
import { testConfig } from './config.js';

export async function createTestApp(options: BuildAppOptions = {}) {
  const app = await buildApp({ ...options, config: options.config ?? testConfig });
  onTestFinished(async () => app.close());
  return app;
}
