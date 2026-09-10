import type { FastifyInstance } from 'fastify';

interface ShutdownRuntime {
  on(signal: NodeJS.Signals, listener: () => void): unknown;
  removeListener(signal: NodeJS.Signals, listener: () => void): unknown;
  exit(code: number): void;
}

export function registerShutdown(
  app: FastifyInstance,
  timeoutMs: number,
  runtime: ShutdownRuntime = process,
): void {
  let shuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    app.log.info({ signal }, 'Graceful shutdown started');

    const deadline = setTimeout(() => {
      app.log.error('Graceful shutdown timed out');
      runtime.exit(1);
    }, timeoutMs);

    try {
      await app.close();
      app.log.info('Graceful shutdown completed');
    } catch (error) {
      app.log.error({ err: error }, 'Graceful shutdown failed');
      runtime.exit(1);
    } finally {
      clearTimeout(deadline);
      detach();
    }
  }

  const onInterrupt = (): void => void shutdown('SIGINT');
  const onTerminate = (): void => void shutdown('SIGTERM');
  function detach(): void {
    runtime.removeListener('SIGINT', onInterrupt);
    runtime.removeListener('SIGTERM', onTerminate);
  }

  runtime.on('SIGINT', onInterrupt);
  runtime.on('SIGTERM', onTerminate);
  app.addHook('onClose', async () => {
    if (!shuttingDown) detach();
  });
}
