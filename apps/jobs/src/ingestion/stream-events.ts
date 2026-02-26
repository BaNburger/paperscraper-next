import type { Queue } from 'bullmq';
import {
  OBJECT_CREATED_JOB_NAME,
  buildObjectCreatedJobId,
  objectCreatedJobPayloadSchema,
} from '@paperscraper/shared';
import { addJobIfMissing, createStandardJobOptions } from '../lib/queue-utils';

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
    const jobId = buildObjectCreatedJobId(streamRunId, objectId);
    await addJobIfMissing(
      queue,
      OBJECT_CREATED_JOB_NAME,
      payload,
      createStandardJobOptions(jobId, 3)
    );
  }
}
