import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import {
  INGEST_STREAM_RUNNER_JOB_NAME,
  buildStreamRunnerJobId,
  ingestStreamJobPayloadSchema,
} from '@paperscraper/shared';

function isDuplicateJobError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.toLowerCase().includes('job') && error.message.toLowerCase().includes('exists');
}

export function createStreamQueue(redisUrl: string, queueName: string): {
  queue: Queue;
  close: () => Promise<void>;
} {
  const connection = new IORedis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });
  connection.on('error', () => undefined);

  const queue = new Queue(queueName, { connection });
  return {
    queue,
    async close() {
      await queue.close();
      await connection.quit().catch(() => {
        connection.disconnect();
      });
    },
  };
}

export async function enqueueStreamRunner(queue: Queue, streamId: string): Promise<void> {
  const payload = ingestStreamJobPayloadSchema.parse({ streamId });
  const jobId = buildStreamRunnerJobId(payload.streamId);

  const existing = await queue.getJob(jobId);
  if (existing) {
    return;
  }

  try {
    await queue.add(INGEST_STREAM_RUNNER_JOB_NAME, payload, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 500,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  } catch (error) {
    if (isDuplicateJobError(error)) {
      return;
    }
    throw error;
  }
}
