import type { PrismaClient } from '@paperscraper/db';
import type { Queue } from 'bullmq';
import {
  SCORE_OBJECT_JOB_NAME,
  buildScoreObjectJobId,
  scoreBackfillDimensionJobPayloadSchema,
  scoreObjectJobPayloadSchema,
} from '@paperscraper/shared';
import { addJobIfMissing, createStandardJobOptions } from '../lib/queue-utils';

const BACKFILL_BATCH_SIZE = 100;

type BackfillDimensionDeps = {
  prisma: PrismaClient;
  graphQueue: Queue;
};

export async function runScoreBackfillDimension(
  deps: BackfillDimensionDeps,
  payloadInput: unknown
): Promise<{ enqueuedCount: number }> {
  const payload = scoreBackfillDimensionJobPayloadSchema.parse(payloadInput);
  const dimension = await deps.prisma.dimension.findUnique({
    where: { id: payload.dimensionId },
    select: { id: true, isActive: true },
  });
  if (!dimension || !dimension.isActive) {
    return { enqueuedCount: 0 };
  }

  let enqueuedCount = 0;
  let cursor: string | null = null;
  while (true) {
    const rows: Array<{ id: string; source: string }> =
      await deps.prisma.researchObject.findMany({
        where: {
          ...(cursor ? { id: { gt: cursor } } : {}),
          scores: {
            none: { dimensionId: payload.dimensionId },
          },
        },
        orderBy: { id: 'asc' },
        take: BACKFILL_BATCH_SIZE,
        select: { id: true, source: true },
      });
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const scorePayload = scoreObjectJobPayloadSchema.parse({
        objectId: row.id,
        dimensionId: payload.dimensionId,
        source: row.source,
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

    cursor = rows[rows.length - 1]?.id || null;
    if (rows.length < BACKFILL_BATCH_SIZE) {
      break;
    }
  }

  return { enqueuedCount };
}
