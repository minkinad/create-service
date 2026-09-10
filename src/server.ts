import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';
import { registerShutdown } from './lib/shutdown.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp({ config });
  registerShutdown(app, config.SHUTDOWN_TIMEOUT_MS);

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
  } catch (error) {
    app.log.fatal({ err: error }, 'Service failed to start');
    try {
      await app.close();
    } finally {
      process.exitCode = 1;
    }
  }
}

try {
  await main();
} catch (error) {
  console.error('Service bootstrap failed:', error);
  process.exitCode = 1;
}
