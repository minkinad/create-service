import Fastify, { type FastifyInstance } from 'fastify';
import { type AppConfig, loadConfig } from './config/env.js';
import type { ReadinessCheck } from './lib/readiness.js';
import { greetingRoutes } from './modules/greeting/greeting.routes.js';
import { GreetingService } from './modules/greeting/greeting.service.js';
import { registerDocumentation } from './plugins/documentation.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerMetrics } from './plugins/metrics.js';
import { loggerOptions, registerRequestContext, requestId } from './plugins/request-context.js';
import { registerSecurity } from './plugins/security.js';
import { healthRoutes } from './routes/health.js';

export interface BuildAppOptions {
  config?: AppConfig;
  readinessChecks?: Record<string, ReadinessCheck>;
  greetingService?: Pick<GreetingService, 'greet'>;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    requestIdHeader: false,
    genReqId: requestId,
    logger: loggerOptions(config),
  });

  try {
    registerRequestContext(app);
    registerErrorHandler(app);
    // Measure requests before hooks that can reject them, including CORS and rate limiting.
    if (config.METRICS_ENABLED) await registerMetrics(app);
    await registerSecurity(app, config);
    await registerDocumentation(app, config);

    await app.register(healthRoutes, {
      serviceName: config.SERVICE_NAME,
      serviceVersion: config.SERVICE_VERSION,
      readinessChecks: options.readinessChecks ?? {},
      readinessTimeoutMs: config.READINESS_TIMEOUT_MS,
    });
    await app.register(greetingRoutes, {
      prefix: '/api/v1',
      service: options.greetingService ?? new GreetingService(),
    });

    return app;
  } catch (error) {
    await app.close().catch((closeError: unknown) => {
      app.log.error({ err: closeError }, 'Failed to close application after initialization error');
    });
    throw error;
  }
}
