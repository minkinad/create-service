import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkReadiness } from '../src/lib/readiness.js';

afterEach(() => vi.useRealTimers());

describe('Readiness checks', () => {
  it('starts dependencies concurrently and clears deadlines after success', async () => {
    vi.useFakeTimers();
    const started: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const result = checkReadiness(
      {
        first: async () => {
          started.push('first');
          await gate;
        },
        second: async () => {
          started.push('second');
          await gate;
        },
      },
      100,
    );
    await Promise.resolve();
    expect(started).toEqual(['first', 'second']);
    release();
    await expect(result).resolves.toEqual({ first: 'up', second: 'up' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('bounds all hanging checks by one timeout interval', async () => {
    vi.useFakeTimers();
    const result = checkReadiness(
      {
        first: () => new Promise<void>(() => {}),
        second: () => new Promise<void>(() => {}),
      },
      100,
    );
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toEqual({ first: 'down', second: 'down' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles late rejections after a timeout', async () => {
    vi.useFakeTimers();
    let reject: (error: Error) => void = () => {};
    const result = checkReadiness(
      {
        database: () =>
          new Promise<void>((_resolve, rejectCheck) => {
            reject = rejectCheck;
          }),
      },
      100,
    );
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toEqual({ database: 'down' });
    reject(new Error('late rejection'));
    await Promise.resolve();
    expect(vi.getTimerCount()).toBe(0);
  });
});
