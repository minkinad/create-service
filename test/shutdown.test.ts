import { EventEmitter } from 'node:events';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { registerShutdown } from '../src/lib/shutdown.js';

function setup() {
  const app = Fastify({ logger: false });
  const runtime = Object.assign(new EventEmitter(), { exit: vi.fn() });
  registerShutdown(app, 100, runtime);
  onTestFinished(async () => {
    await app.close().catch(() => {});
  });
  return { app, runtime };
}

afterEach(() => vi.useRealTimers());

describe('Graceful shutdown', () => {
  it.each(['SIGINT', 'SIGTERM'])(
    'closes the application on %s and removes signal listeners',
    async (signal) => {
      const { app, runtime } = setup();
      const closed = vi.fn();
      app.addHook('onClose', async () => {
        closed();
      });
      await app.ready();
      runtime.emit(signal);
      await vi.waitFor(() => expect(runtime.listenerCount('SIGTERM')).toBe(0));
      expect(runtime.listenerCount('SIGINT')).toBe(0);
      expect(closed).toHaveBeenCalledOnce();
      expect(runtime.exit).not.toHaveBeenCalled();
    },
  );

  it('ignores repeated signals while cleanup is in progress', async () => {
    const { app, runtime } = setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    app.addHook('onClose', async () => gate);
    const close = vi.spyOn(app, 'close');
    await app.ready();
    runtime.emit('SIGTERM');
    runtime.emit('SIGTERM');
    runtime.emit('SIGINT');
    expect(close).toHaveBeenCalledOnce();
    release();
    await vi.waitFor(() => expect(runtime.listenerCount('SIGTERM')).toBe(0));
    expect(runtime.exit).not.toHaveBeenCalled();
  });

  it('exits with failure when cleanup exceeds the deadline', async () => {
    vi.useFakeTimers();
    const { app, runtime } = setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    app.addHook('onClose', async () => gate);
    await app.ready();
    runtime.emit('SIGTERM');
    await vi.advanceTimersByTimeAsync(100);
    expect(runtime.exit).toHaveBeenCalledWith(1);
    release();
    await app.close();
  });

  it('exits with failure when a close hook fails', async () => {
    const { app, runtime } = setup();
    app.addHook('onClose', async () => {
      throw new Error('close failed');
    });
    await app.ready();
    runtime.emit('SIGINT');
    await vi.waitFor(() => expect(runtime.exit).toHaveBeenCalledWith(1));
    expect(runtime.listenerCount('SIGINT')).toBe(0);
  });

  it('detaches listeners when the application is closed directly', async () => {
    const { app, runtime } = setup();
    await app.close();
    expect(runtime.listenerCount('SIGINT')).toBe(0);
    expect(runtime.listenerCount('SIGTERM')).toBe(0);
    expect(runtime.exit).not.toHaveBeenCalled();
  });
});
