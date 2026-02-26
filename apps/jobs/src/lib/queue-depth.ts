import type { Queue } from 'bullmq';
import type { QueueDepthSnapshot } from '@paperscraper/shared';

type QueueLike = Pick<Queue, 'getJobCounts'>;

export async function readQueueDepth(queue: QueueLike): Promise<QueueDepthSnapshot> {
  const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
  return {
    waiting: counts.waiting || 0,
    active: counts.active || 0,
    delayed: counts.delayed || 0,
    failed: counts.failed || 0,
  };
}

export function createMemoizedQueueDepthReader(
  queue: QueueLike
): () => Promise<QueueDepthSnapshot> {
  let pending: Promise<QueueDepthSnapshot> | null = null;
  return async () => {
    if (!pending) {
      pending = readQueueDepth(queue);
    }
    return pending;
  };
}
