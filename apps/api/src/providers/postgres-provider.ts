import { Client } from 'pg';
import {
  dependencyHealthSchema,
  type DependencyHealth,
} from '@paperscraper/shared';

export async function probePostgres(databaseUrl: string): Promise<DependencyHealth> {
  const startedAt = Date.now();
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    await client.query('SELECT 1 AS one');
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
