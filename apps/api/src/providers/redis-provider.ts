import IORedis from 'ioredis';
import {
  dependencyHealthSchema,
  type DependencyHealth,
} from '@paperscraper/shared';

function withTimeout(promise: Promise<unknown>, timeoutMs: number, message: string): Promise<unknown> {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

export async function probeRedis(redisUrl: string, timeoutMs: number): Promise<DependencyHealth> {
  const startedAt = Date.now();
  const client = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });
  client.on('error', () => undefined);

  try {
    await withTimeout(
      (async () => {
        await client.connect();
        await client.ping();
      })(),
      timeoutMs,
      `Redis probe timeout after ${timeoutMs}ms`
    );
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
