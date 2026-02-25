import {
  workerReadinessLogSchema,
  type WorkerReadinessLog,
} from '@paperscraper/shared';

interface WorkerReadinessOptions {
  ping: () => Promise<void>;
  maxAttempts: number;
  baseDelayMs: number;
  onRetry?: (entry: WorkerReadinessLog) => void;
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown readiness error';
}

function retryDelay(baseDelayMs: number, attempt: number): number {
  return Math.min(baseDelayMs * Math.pow(2, attempt - 1), 2000);
}

export async function runWorkerReadinessCheck(
  options: WorkerReadinessOptions
): Promise<WorkerReadinessLog> {
  const start = Date.now();
  let lastReason = 'Readiness check failed';

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      await options.ping();
      return workerReadinessLogSchema.parse({
        state: 'ready',
        component: 'jobs-worker',
        attempt,
        durationMs: Date.now() - start,
      });
    } catch (error) {
      lastReason = errorReason(error);
      if (attempt < options.maxAttempts) {
        const retryLog = workerReadinessLogSchema.parse({
          state: 'degraded',
          component: 'jobs-worker',
          attempt,
          durationMs: Date.now() - start,
          reason: lastReason,
        });
        options.onRetry?.(retryLog);
        await wait(retryDelay(options.baseDelayMs, attempt));
      }
    }
  }

  return workerReadinessLogSchema.parse({
    state: 'failed',
    component: 'jobs-worker',
    attempt: options.maxAttempts,
    durationMs: Date.now() - start,
    reason: lastReason,
  });
}
