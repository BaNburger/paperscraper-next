import type { JobsOptions, Queue } from 'bullmq';

type QueueLike = Pick<Queue, 'add' | 'getJob'>;

export function isDuplicateJobError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes('job') && message.includes('exists');
}

export function createStandardJobOptions(
  jobId: string,
  attempts: number
): JobsOptions & { jobId: string } {
  return {
    jobId,
    attempts,
    backoff: { type: 'exponential', delay: 500 },
    removeOnComplete: true,
    removeOnFail: false,
  };
}

export async function addJobIfMissing(
  queue: QueueLike,
  name: string,
  payload: unknown,
  options: JobsOptions & { jobId: string }
): Promise<boolean> {
  const existing = await queue.getJob(options.jobId);
  if (existing) {
    return false;
  }
  try {
    await queue.add(name, payload, options);
  } catch (error) {
    if (isDuplicateJobError(error)) {
      return false;
    }
    throw error;
  }
  return true;
}
