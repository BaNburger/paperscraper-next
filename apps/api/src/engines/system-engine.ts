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

function probeResultToDependency(
  result: PromiseSettledResult<DependencyHealth>,
  dependencyName: string
): DependencyHealth {
  if (result.status === 'fulfilled') {
    return result.value;
  }

  return {
    status: 'failed',
    reason: `${dependencyName} probe failed: ${errorReason(result.reason)}`,
  };
}

function diagnosticsReason(postgres: DependencyHealth, redis: DependencyHealth): string | undefined {
  const failedReasons = [];
  if (postgres.status === 'failed') {
    failedReasons.push(`postgres: ${postgres.reason || 'unknown failure'}`);
  }
  if (redis.status === 'failed') {
    failedReasons.push(`redis: ${redis.reason || 'unknown failure'}`);
  }

  if (failedReasons.length === 0) {
    return undefined;
  }
  return failedReasons.join('; ');
}

export function createSystemEngine(deps: SystemEngineDeps) {
  return {
    async getHealthSnapshot() {
      const [postgresResult, redisResult] = await Promise.allSettled([
        deps.postgresProbe(),
        deps.redisProbe(),
      ]);

      const postgres = probeResultToDependency(postgresResult, 'PostgreSQL');
      const redis = probeResultToDependency(redisResult, 'Redis');
      const reason = diagnosticsReason(postgres, redis);

      return healthSnapshotSchema.parse({
        status: overallStatus(postgres, redis),
        timestamp: new Date().toISOString(),
        dependencies: {
          postgres,
          redis,
        },
        diagnostics: reason ? { reason } : undefined,
      });
    },
  };
}
