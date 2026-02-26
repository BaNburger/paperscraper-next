import type { PrismaClient } from '@paperscraper/db';
import type { Queue } from 'bullmq';
import { z } from 'zod';
import { foldRunLogSchema, scoreFoldEntityJobPayloadSchema } from '@paperscraper/shared';
import { createMemoizedQueueDepthReader } from '../lib/queue-depth';
import { emitValidatedLog } from '../lib/logging';

type FoldEntityDeps = {
  prisma: PrismaClient;
  graphQueue: Queue;
  log?: (entry: Record<string, unknown>) => void;
};

const HALF_LIFE_DAYS = 365;

function emitLog(
  log: ((entry: Record<string, unknown>) => void) | undefined,
  payload: Omit<z.infer<typeof foldRunLogSchema>, 'component'>
): void {
  emitValidatedLog(
    foldRunLogSchema,
    {
      component: 'jobs-worker',
      ...payload,
    },
    log
  );
}

function weightForAgeDays(ageDays: number): number {
  return Math.exp((-Math.log(2) * ageDays) / HALF_LIFE_DAYS);
}

export async function runFoldEntityScore(
  deps: FoldEntityDeps,
  payloadInput: unknown,
  attempt = 1
): Promise<void> {
  const payload = scoreFoldEntityJobPayloadSchema.parse(payloadInput);
  const startedAt = Date.now();
  const getDepth = createMemoizedQueueDepthReader(deps.graphQueue);
  const links = await deps.prisma.objectEntity.findMany({
    where: { entityId: payload.entityId },
    select: {
      object: {
        select: {
          publishedAt: true,
          createdAt: true,
          scores: {
            where: { dimensionId: payload.dimensionId },
            select: { value: true },
            take: 1,
          },
        },
      },
    },
  });

  let weightedValueSum = 0;
  let totalWeight = 0;
  let sampleSize = 0;
  for (const link of links) {
    const score = link.object.scores[0];
    if (!score) {
      continue;
    }
    const timestamp = link.object.publishedAt || link.object.createdAt;
    const ageDays = Math.max(0, (Date.now() - timestamp.getTime()) / (24 * 60 * 60 * 1000));
    const weight = weightForAgeDays(ageDays);
    weightedValueSum += score.value * weight;
    totalWeight += weight;
    sampleSize += 1;
  }

  if (sampleSize === 0 || totalWeight <= 0) {
    await deps.prisma.entityScore.deleteMany({
      where: {
        entityId: payload.entityId,
        dimensionId: payload.dimensionId,
      },
    });
    emitLog(deps.log, {
      state: 'ready',
      entityId: payload.entityId,
      dimensionId: payload.dimensionId,
      attempt,
      durationMs: Date.now() - startedAt,
      sampleSize: 0,
      queueDepth: {
        graph: await getDepth(),
      },
    });
    return;
  }

  const aggregateValue = weightedValueSum / totalWeight;
  await deps.prisma.entityScore.upsert({
    where: {
      dimensionId_entityId: {
        dimensionId: payload.dimensionId,
        entityId: payload.entityId,
      },
    },
    create: {
      entityId: payload.entityId,
      dimensionId: payload.dimensionId,
      value: aggregateValue,
      explanation: `Recency-weighted mean of ${sampleSize} object scores (halfLifeDays=${HALF_LIFE_DAYS}).`,
      metadata: {
        halfLifeDays: HALF_LIFE_DAYS,
        sampleSize,
        weightSum: totalWeight,
      },
    },
    update: {
      value: aggregateValue,
      explanation: `Recency-weighted mean of ${sampleSize} object scores (halfLifeDays=${HALF_LIFE_DAYS}).`,
      metadata: {
        halfLifeDays: HALF_LIFE_DAYS,
        sampleSize,
        weightSum: totalWeight,
      },
    },
    select: { id: true },
  });

  emitLog(deps.log, {
    state: 'ready',
    entityId: payload.entityId,
    dimensionId: payload.dimensionId,
    attempt,
    durationMs: Date.now() - startedAt,
    scoreValue: aggregateValue,
    sampleSize,
    queueDepth: {
      graph: await getDepth(),
    },
  });
}
