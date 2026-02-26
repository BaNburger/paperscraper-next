import type { PrismaClient } from '@paperscraper/db';
import type { Queue } from 'bullmq';
import {
  SCORE_OBJECT_JOB_NAME,
  buildScoreObjectJobId,
  objectReadyJobPayloadSchema,
  scoreObjectJobPayloadSchema,
} from '@paperscraper/shared';
import { addJobIfMissing, createStandardJobOptions } from '../lib/queue-utils';

type QueueScoreObjectDeps = {
  prisma: PrismaClient;
  graphQueue: Queue;
};

function uniqueDimensionIds(value: Array<{ id: string }>): string[] {
  return Array.from(new Set(value.map((item) => item.id)));
}

export async function runQueueScoreObject(
  deps: QueueScoreObjectDeps,
  payloadInput: unknown
): Promise<{ enqueuedCount: number }> {
  const payload = objectReadyJobPayloadSchema.parse(payloadInput);
  const object = await deps.prisma.researchObject.findUnique({
    where: { id: payload.objectId },
    select: { id: true },
  });
  if (!object) {
    return { enqueuedCount: 0 };
  }

  const dimensions = await deps.prisma.dimension.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const dimensionIds = uniqueDimensionIds(dimensions);
  if (dimensionIds.length === 0) {
    return { enqueuedCount: 0 };
  }

  const existingScores = await deps.prisma.objectScore.findMany({
    where: {
      objectId: payload.objectId,
      dimensionId: { in: dimensionIds },
    },
    select: { dimensionId: true },
  });
  const existing = new Set(existingScores.map((item) => item.dimensionId));

  let enqueuedCount = 0;
  for (const dimensionId of dimensionIds) {
    if (existing.has(dimensionId)) {
      continue;
    }
    const scorePayload = scoreObjectJobPayloadSchema.parse({
      objectId: payload.objectId,
      dimensionId,
      source: payload.source,
    });
    const jobId = buildScoreObjectJobId(scorePayload.dimensionId, scorePayload.objectId);
    const enqueued = await addJobIfMissing(
      deps.graphQueue,
      SCORE_OBJECT_JOB_NAME,
      scorePayload,
      createStandardJobOptions(jobId, 4)
    );
    if (enqueued) {
      enqueuedCount += 1;
    }
  }
  return { enqueuedCount };
}
