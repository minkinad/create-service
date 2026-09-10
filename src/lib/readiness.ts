export type ReadinessCheck = (signal: AbortSignal) => void | Promise<void>;
export type ReadinessStatus = 'up' | 'down';

async function runCheck(check: ReadinessCheck, timeoutMs: number): Promise<ReadinessStatus> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;

  try {
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Readiness check timed out');
        reject(error);
        controller.abort(error);
      }, timeoutMs);
    });
    await Promise.race([Promise.resolve().then(() => check(controller.signal)), deadline]);
    return 'up';
  } catch {
    return 'down';
  } finally {
    clearTimeout(timer);
  }
}

export async function checkReadiness(
  checks: Record<string, ReadinessCheck>,
  timeoutMs: number,
): Promise<Record<string, ReadinessStatus>> {
  const results = await Promise.all(
    Object.entries(checks).map(
      async ([name, check]) => [name, await runCheck(check, timeoutMs)] as const,
    ),
  );
  return Object.fromEntries(results);
}
