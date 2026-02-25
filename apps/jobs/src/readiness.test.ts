import { describe, expect, it } from 'vitest';
import { runWorkerReadinessCheck } from './readiness';

describe('worker readiness check', () => {
  it('emits degraded retries and recovers as ready', async () => {
    const retryStates: string[] = [];
    let attempts = 0;

    const result = await runWorkerReadinessCheck({
      ping: async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('Redis not reachable yet');
        }
      },
      maxAttempts: 3,
      baseDelayMs: 1,
      onRetry: (entry) => {
        retryStates.push(entry.state);
      },
    });

    expect(result.state).toBe('ready');
    expect(result.attempt).toBe(2);
    expect(retryStates).toEqual(['degraded']);
  });

  it('returns failed after max retries', async () => {
    const result = await runWorkerReadinessCheck({
      ping: async () => {
        throw new Error('Redis down');
      },
      maxAttempts: 2,
      baseDelayMs: 1,
    });

    expect(result.state).toBe('failed');
    expect(result.attempt).toBe(2);
    expect(result.reason).toContain('Redis down');
  });
});
