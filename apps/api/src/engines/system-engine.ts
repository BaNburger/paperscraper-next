import {
  healthSnapshotSchema,
  type DependencyHealth,
  type HealthSnapshot,
} from '@paperscraper/shared';

type DependencyProbe = () => Promise<DependencyHealth>;

interface SystemEngineDeps {
  postgresProbe: DependencyProbe;
  redisProbe: DependencyProbe;
}

function overallStatus(postgres: DependencyHealth, redis: DependencyHealth): HealthSnapshot['status'] {
  if (postgres.status === 'failed' || redis.status === 'failed') {
    return 'failed';
  }
  if (postgres.status === 'degraded' || redis.status === 'degraded') {
    return 'degraded';
  }
  return 'ok';
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown health check error';
}

export function createSystemEngine(deps: SystemEngineDeps) {
  return {
    async getHealthSnapshot() {
      try {
        const [postgres, redis] = await Promise.all([
          deps.postgresProbe(),
          deps.redisProbe(),
        ]);

        return healthSnapshotSchema.parse({
          status: overallStatus(postgres, redis),
          timestamp: new Date().toISOString(),
          dependencies: {
            postgres,
            redis,
          },
        });
      } catch (error) {
        const reason = errorReason(error);
        return healthSnapshotSchema.parse({
          status: 'failed',
          timestamp: new Date().toISOString(),
          dependencies: {
            postgres: { status: 'failed', reason },
            redis: { status: 'failed', reason },
          },
          diagnostics: { reason },
        });
      }
    },
  };
}
