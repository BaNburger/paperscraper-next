import { PrismaClient } from '@paperscraper/db';
import { Queue, Worker, type Job } from 'bullmq';
import {
  INGEST_STREAM_RUNNER_JOB_NAME,
  OBJECT_CREATED_JOB_NAME,
  OBJECT_READY_JOB_NAME,
  SCORE_BACKFILL_DIMENSION_JOB_NAME,
  SCORE_FOLD_ENTITY_JOB_NAME,
  SCORE_OBJECT_JOB_NAME,
  workerReadinessLogSchema,
  type WorkerReadinessLog,
} from '@paperscraper/shared';
import { emitValidatedLog } from './lib/logging';
import type { JobsEnv } from './config';
import { runGraphResolveObject } from './graph/resolve-object';
import { createOpenAlexProvider } from './ingestion/openalex-provider';
import type { OpenAlexFetchResult, OpenAlexRetryLog } from './ingestion/openalex-provider';
import { runIngestStreamRunner } from './ingestion/stream-runner';
import { closeRedis, createRedisClient, pingRedis } from './providers/redis-provider';
import { runWorkerReadinessCheck } from './readiness';
import { runScoreBackfillDimension } from './scoring/backfill-dimension';
import { runFoldEntityScore } from './scoring/fold-entity';
import { createAnthropicScorer, createOpenAiScorer } from './scoring/llm-provider';
import { runQueueScoreObject } from './scoring/queue-score-object';
import { runScoreObject } from './scoring/score-object';

type CloseFn = () => Promise<void>;
type WorkerResult = { accepted?: boolean; ignored?: boolean };
type JobHandler = (job: Job) => Promise<WorkerResult>;

function emitWorkerLog(entry: WorkerReadinessLog): void {
  emitValidatedLog(workerReadinessLogSchema, entry, undefined);
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

async function runBoundedCloseSequence(closers: [string, CloseFn][]): Promise<void> {
  for (const [resourceName, close] of closers) {
    try {
      await withTimeout(close(), 3000, `Timed out while closing ${resourceName}`);
    } catch (error) {
      logDegraded(error instanceof Error ? error.message : 'Unknown shutdown error');
    }
  }
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

function createIngestJobHandlers(
  prisma: PrismaClient,
  ingestQueue: Queue,
  graphQueue: Queue,
  fetchWorks: (
    query: string,
    maxObjects: number,
    onRetry?: (event: OpenAlexRetryLog) => void
  ) => Promise<OpenAlexFetchResult>
): Record<string, JobHandler> {
  return {
    [INGEST_STREAM_RUNNER_JOB_NAME]: async (job) => {
      await runIngestStreamRunner(
        {
          prisma,
          ingestQueue,
          graphQueue,
          fetchWorks,
          log: (entry) => console.log(JSON.stringify(entry)),
        },
        job.data
      );
      return { accepted: true };
    },
  };
}

function createGraphJobHandlers(
  env: JobsEnv,
  prisma: PrismaClient,
  graphQueue: Queue,
  openAiScorer: ReturnType<typeof createOpenAiScorer>,
  anthropicScorer: ReturnType<typeof createAnthropicScorer>
): Record<string, JobHandler> {
  return {
    [OBJECT_CREATED_JOB_NAME]: async (job) => {
      await runGraphResolveObject(
        {
          prisma,
          graphQueue,
          log: (entry) => console.log(JSON.stringify(entry)),
        },
        job.data
      );
      return { accepted: true };
    },
    [OBJECT_READY_JOB_NAME]: async (job) => {
      await runQueueScoreObject({ prisma, graphQueue }, job.data);
      return { accepted: true };
    },
    [SCORE_OBJECT_JOB_NAME]: async (job) => {
      await runScoreObject(
        {
          prisma,
          graphQueue,
          openAiScorer,
          anthropicScorer,
          secretsMasterKey: env.SECRETS_MASTER_KEY,
          log: (entry) => console.log(JSON.stringify(entry)),
        },
        job.data,
        job.attemptsMade + 1
      );
      return { accepted: true };
    },
    [SCORE_FOLD_ENTITY_JOB_NAME]: async (job) => {
      await runFoldEntityScore(
        {
          prisma,
          graphQueue,
          log: (entry) => console.log(JSON.stringify(entry)),
        },
        job.data,
        job.attemptsMade + 1
      );
      return { accepted: true };
    },
    [SCORE_BACKFILL_DIMENSION_JOB_NAME]: async (job) => {
      await runScoreBackfillDimension({ prisma, graphQueue }, job.data);
      return { accepted: true };
    },
  };
}

async function dispatchJob(
  job: Job,
  handlers: Record<string, JobHandler>,
  unknownJobReasonPrefix: string
): Promise<WorkerResult> {
  const handler = handlers[job.name];
  if (!handler) {
    logDegraded(`${unknownJobReasonPrefix}: ${job.name}`);
    return { ignored: true };
  }
  return handler(job);
}

export interface JobsRuntime {
  close: () => Promise<void>;
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
  const openAiScorer = createOpenAiScorer({
    baseUrl: env.OPENAI_BASE_URL,
    timeoutMs: env.OPENAI_TIMEOUT_MS,
    maxRetries: env.OPENAI_MAX_RETRIES,
    baseDelayMs: env.OPENAI_RETRY_BASE_DELAY_MS,
  });
  const anthropicScorer = createAnthropicScorer({
    baseUrl: env.ANTHROPIC_BASE_URL,
    timeoutMs: env.ANTHROPIC_TIMEOUT_MS,
    maxRetries: env.ANTHROPIC_MAX_RETRIES,
    baseDelayMs: env.ANTHROPIC_RETRY_BASE_DELAY_MS,
  });

  const ingestHandlers = createIngestJobHandlers(
    prisma,
    ingestQueue,
    graphQueue,
    (query, maxObjects, onRetry) => openAlexProvider.fetchWorks(query, maxObjects, onRetry)
  );
  const graphHandlers = createGraphJobHandlers(
    env,
    prisma,
    graphQueue,
    openAiScorer,
    anthropicScorer
  );

  const ingestWorker = new Worker(
    env.JOB_QUEUE_NAME,
    async (job) => dispatchJob(job, ingestHandlers, 'Unknown ingest job'),
    {
      connection: workerConnection,
      concurrency: env.JOB_WORKER_CONCURRENCY,
    }
  );

  const graphWorker = new Worker(
    env.GRAPH_QUEUE_NAME,
    async (job) => dispatchJob(job, graphHandlers, 'Unknown graph job'),
    {
      connection: graphQueueConnection,
      concurrency: env.GRAPH_WORKER_CONCURRENCY,
    }
  );

  ingestWorker.on('error', (error) => {
    logDegraded(error.message);
  });
  graphWorker.on('error', (error) => {
    logDegraded(error.message);
  });

  let shuttingDown = false;
  const close = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await runBoundedCloseSequence([
      ['ingest worker', ingestWorker.close.bind(ingestWorker)],
      ['graph worker', graphWorker.close.bind(graphWorker)],
      ['ingest queue', ingestQueue.close.bind(ingestQueue)],
      ['graph queue', graphQueue.close.bind(graphQueue)],
      ['database', prisma.$disconnect.bind(prisma)],
      ['worker redis connection', closeRedis.bind(null, workerConnection)],
      ['ingest redis connection', closeRedis.bind(null, ingestQueueConnection)],
      ['graph redis connection', closeRedis.bind(null, graphQueueConnection)],
    ]);
  };

  return { close };
}

export async function startJobsApp(env: JobsEnv): Promise<JobsRuntime> {
  await runJobsReadiness(env);
  return startJobsRuntime(env);
}
