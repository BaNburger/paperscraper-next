import type { Queue } from 'bullmq';
import {
  OBJECT_CREATED_JOB_NAME,
  buildObjectCreatedJobId,
  objectCreatedJobPayloadSchema,
} from '@paperscraper/shared';

export async function emitObjectCreatedEvents(
  queue: Queue,
  insertedObjectIds: string[],
  streamId: string,
  streamRunId: string
): Promise<void> {
  for (const objectId of insertedObjectIds) {
    const payload = objectCreatedJobPayloadSchema.parse({
      objectId,
      streamId,
      streamRunId,
      source: 'openalex',
    });
    await queue.add(OBJECT_CREATED_JOB_NAME, payload, {
      jobId: buildObjectCreatedJobId(streamRunId, objectId),
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
