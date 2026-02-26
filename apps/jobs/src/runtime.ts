import { PrismaClient } from '@paperscraper/db';
import { Queue, Worker } from 'bullmq';
import {
  INGEST_STREAM_RUNNER_JOB_NAME,
  workerReadinessLogSchema,
  type WorkerReadinessLog,
} from '@paperscraper/shared';
import type { JobsEnv } from './config';
import { createOpenAlexProvider } from './ingestion/openalex-provider';
import { runIngestStreamRunner } from './ingestion/stream-runner';
import {
  closeRedis,
  createRedisClient,
  pingRedis,
} from './providers/redis-provider';
import { runWorkerReadinessCheck } from './readiness';

type CloseFn = () => Promise<void>;

function emitWorkerLog(entry: WorkerReadinessLog): void {
  console.log(JSON.stringify(workerReadinessLogSchema.parse(entry)));
}

function logDegraded(reason: string): void {
  emitWorkerLog({
    state: 'degraded',
    component: 'jobs-worker',
    attempt: 1,
    durationMs: 0,
    reason,
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

async function closeResource(
  resourceName: string,
  close: CloseFn
): Promise<void> {
  try {
    await withTimeout(close(), 3000, `Timed out while closing ${resourceName}`);
  } catch (error) {
    logDegraded(error instanceof Error ? error.message : 'Unknown shutdown error');
  }
}

export interface JobsRuntime {
  close: () => Promise<void>;
}

async function runJobsReadiness(env: JobsEnv): Promise<void> {
  const readinessClient = createRedisClient(env.REDIS_URL, true);
  try {
    const readinessLog = await runWorkerReadinessCheck({
      ping: () => pingRedis(readinessClient),
      maxAttempts: env.JOB_READINESS_MAX_ATTEMPTS,
      baseDelayMs: env.JOB_READINESS_BASE_DELAY_MS,
      onRetry: emitWorkerLog,
    });
    emitWorkerLog(readinessLog);
    if (readinessLog.state === 'failed') {
      throw new Error(readinessLog.reason || 'Jobs readiness check failed.');
    }
  } finally {
    await closeRedis(readinessClient);
  }
}

export function startJobsRuntime(env: JobsEnv): JobsRuntime {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: env.DATABASE_URL },
    },
  });

  const workerConnection = createRedisClient(env.REDIS_URL, false);
  const ingestQueueConnection = createRedisClient(env.REDIS_URL, false);
  const graphQueueConnection = createRedisClient(env.REDIS_URL, false);
  const ingestQueue = new Queue(env.JOB_QUEUE_NAME, {
    connection: ingestQueueConnection,
  });
  const graphQueue = new Queue(env.GRAPH_QUEUE_NAME, {
    connection: graphQueueConnection,
  });
  const openAlexProvider = createOpenAlexProvider({
    baseUrl: env.OPENALEX_BASE_URL,
    apiKey: env.OPENALEX_API_KEY,
    timeoutMs: env.OPENALEX_TIMEOUT_MS,
    maxRetries: env.OPENALEX_MAX_RETRIES,
    baseDelayMs: env.OPENALEX_RETRY_BASE_DELAY_MS,
  });

  const worker = new Worker(
    env.JOB_QUEUE_NAME,
    async (job) => {
      if (job.name !== INGEST_STREAM_RUNNER_JOB_NAME) {
        logDegraded(`Unknown job: ${job.name}`);
        return { ignored: true };
      }

      await runIngestStreamRunner(
        {
          prisma,
          ingestQueue,
          graphQueue,
          fetchWorks: (query, maxObjects, onRetry) =>
            openAlexProvider.fetchWorks(query, maxObjects, onRetry),
          log: (entry) => {
            console.log(JSON.stringify(entry));
          },
        },
        job.data
      );
      return { accepted: true };
    },
    {
      connection: workerConnection,
      concurrency: env.JOB_WORKER_CONCURRENCY,
    }
  );

  worker.on('error', (error) => {
    logDegraded(error.message);
  });

  let shuttingDown = false;
  const close = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    const closers: [string, CloseFn][] = [
      ['worker', () => worker.close()],
      ['ingest queue', () => ingestQueue.close()],
      ['graph queue', () => graphQueue.close()],
      ['database', () => prisma.$disconnect()],
      ['worker redis connection', () => closeRedis(workerConnection)],
      ['ingest redis connection', () => closeRedis(ingestQueueConnection)],
      ['graph redis connection', () => closeRedis(graphQueueConnection)],
    ];
    for (const [name, closeFn] of closers) {
      await closeResource(name, closeFn);
    }
  };

  return { close };
}

export async function startJobsApp(env: JobsEnv): Promise<JobsRuntime> {
  await runJobsReadiness(env);
  return startJobsRuntime(env);
}
