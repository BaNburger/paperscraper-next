import { Client } from 'pg';
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

export async function probePostgres(databaseUrl: string, timeoutMs: number): Promise<DependencyHealth> {
  const startedAt = Date.now();
  const client = new Client({ connectionString: databaseUrl });

  try {
    await withTimeout(
      (async () => {
        await client.connect();
        await client.query('SELECT 1 AS one');
      })(),
      timeoutMs,
      `PostgreSQL probe timeout after ${timeoutMs}ms`
    );
    return dependencyHealthSchema.parse({
      status: 'ready',
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    return dependencyHealthSchema.parse({
      status: 'degraded',
      latencyMs: Date.now() - startedAt,
      reason: error instanceof Error ? error.message : 'Unknown PostgreSQL error',
    });
  } finally {
    await client.end().catch(() => undefined);
  }
}
