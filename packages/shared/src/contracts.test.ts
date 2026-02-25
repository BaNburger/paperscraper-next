import { describe, expect, it } from 'vitest';
import {
  healthSnapshotSchema,
  workerReadinessLogSchema,
} from './contracts';

describe('shared contracts', () => {
  it('accepts a valid health snapshot payload', () => {
    const parsed = healthSnapshotSchema.parse({
      status: 'ok',
      timestamp: '2026-02-24T00:00:00.000Z',
      dependencies: {
        postgres: { status: 'ready', latencyMs: 7 },
        redis: { status: 'ready', latencyMs: 3 },
      },
    });

    expect(parsed.status).toBe('ok');
  });

  it('validates worker readiness logs', () => {
    const parsed = workerReadinessLogSchema.parse({
      state: 'degraded',
      component: 'jobs-worker',
      attempt: 2,
      durationMs: 220,
      reason: 'Redis temporarily unavailable',
    });

    expect(parsed.component).toBe('jobs-worker');
  });
});
