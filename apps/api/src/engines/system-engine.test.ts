import { describe, expect, it } from 'vitest';
import { createSystemEngine } from './system-engine';

describe('system engine', () => {
  it('returns ok when both dependencies are ready', async () => {
    const readyProbe = async () => ({
      status: 'ready' as const,
      latencyMs: 10,
    });
    const engine = createSystemEngine({
      postgresProbe: readyProbe,
      redisProbe: readyProbe,
    });

    const health = await engine.getHealthSnapshot();
    expect(health.status).toBe('ok');
  });

  it('returns degraded when one dependency is degraded', async () => {
    const engine = createSystemEngine({
      postgresProbe: async () => ({ status: 'ready', latencyMs: 4 }),
      redisProbe: async () => ({
        status: 'degraded',
        latencyMs: 7,
        reason: 'Redis timeout',
      }),
    });

    const health = await engine.getHealthSnapshot();
    expect(health.status).toBe('degraded');
  });

  it('returns failed when probing throws', async () => {
    const engine = createSystemEngine({
      postgresProbe: async () => {
        throw new Error('Probe crashed');
      },
      redisProbe: async () => ({ status: 'ready', latencyMs: 1 }),
    });

    const health = await engine.getHealthSnapshot();
    expect(health.status).toBe('failed');
    expect(health.diagnostics?.reason).toContain('Probe crashed');
    expect(health.dependencies.postgres.status).toBe('failed');
    expect(health.dependencies.redis.status).toBe('ready');
  });
});
