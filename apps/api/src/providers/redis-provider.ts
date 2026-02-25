import IORedis from 'ioredis';
import {
  dependencyHealthSchema,
  type DependencyHealth,
} from '@paperscraper/shared';

export async function probeRedis(redisUrl: string): Promise<DependencyHealth> {
  const startedAt = Date.now();
  const client = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });
  client.on('error', () => undefined);

  try {
    await client.connect();
    await client.ping();
    return dependencyHealthSchema.parse({
      status: 'ready',
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    return dependencyHealthSchema.parse({
      status: 'degraded',
      latencyMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : 'Unknown Redis error',
    });
  } finally {
    await client.quit().catch(() => {
      client.disconnect();
    });
  }
}
