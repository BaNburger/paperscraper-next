import { Worker } from 'bullmq';
import { loadJobsEnv } from './config';
import {
  closeRedis,
  createRedisClient,
  pingRedis,
} from './providers/redis-provider';
import { runWorkerReadinessCheck } from './readiness';

const env = loadJobsEnv();

const readinessClient = createRedisClient(env.REDIS_URL, true);
const readinessLog = await runWorkerReadinessCheck({
  ping: () => pingRedis(readinessClient),
  maxAttempts: env.JOB_READINESS_MAX_ATTEMPTS,
  baseDelayMs: env.JOB_READINESS_BASE_DELAY_MS,
  onRetry: (entry) => {
    console.log(JSON.stringify(entry));
  },
});

console.log(JSON.stringify(readinessLog));
await closeRedis(readinessClient);

if (readinessLog.state === 'failed') {
  process.exit(1);
}

const workerConnection = createRedisClient(env.REDIS_URL, false);
const worker = new Worker(
  env.JOB_QUEUE_NAME,
  async () => {
    return { accepted: true };
  },
  {
    connection: workerConnection,
    concurrency: env.JOB_WORKER_CONCURRENCY,
  }
);

worker.on('error', (error) => {
  console.error(
    JSON.stringify({
      state: 'degraded',
      component: 'jobs-worker',
      attempt: 1,
      durationMs: 0,
      reason: error.message,
    })
  );
});

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    }),
  ]);
}

let shuttingDown = false;

async function shutdown(): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  try {
    await withTimeout(worker.close(), 3000, 'Timed out while closing worker');
  } catch (error) {
    console.error(
      JSON.stringify({
        state: 'degraded',
        component: 'jobs-worker',
        attempt: 1,
        durationMs: 0,
        reason: error instanceof Error ? error.message : 'Unknown shutdown error',
      })
    );
  }

  try {
    await withTimeout(closeRedis(workerConnection), 3000, 'Timed out while closing Redis connection');
  } catch (error) {
    console.error(
      JSON.stringify({
        state: 'degraded',
        component: 'jobs-worker',
        attempt: 1,
        durationMs: 0,
        reason: error instanceof Error ? error.message : 'Unknown shutdown error',
      })
    );
  }
}

process.on('SIGINT', async () => {
  await shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await shutdown();
  process.exit(0);
});
