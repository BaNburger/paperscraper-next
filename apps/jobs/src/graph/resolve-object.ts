import type { PrismaClient } from '@paperscraper/db';
import type { Queue } from 'bullmq';
import { z } from 'zod';
import {
  OBJECT_READY_JOB_NAME,
  buildObjectReadyJobId,
  graphRunLogSchema,
  objectCreatedJobPayloadSchema,
  objectReadyJobPayloadSchema,
} from '@paperscraper/shared';
import { readQueueDepth } from '../lib/queue-depth';
import { emitValidatedLog } from '../lib/logging';
import { addJobIfMissing, createStandardJobOptions } from '../lib/queue-utils';

type GraphResolverDeps = {
  prisma: PrismaClient;
  graphQueue: Queue;
  log?: (entry: Record<string, unknown>) => void;
};

const sourceMetadataSchema = z.object({
  authorships: z
    .array(
      z.object({
        authorId: z.string().min(1).nullable(),
        authorName: z.string().min(1),
        position: z.number().int().nonnegative(),
      })
    )
    .default([]),
});

const objectSelect = {
  id: true,
  sourceMetadata: true,
} as const;

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function emitLog(
  log: ((entry: Record<string, unknown>) => void) | undefined,
  payload: Omit<z.infer<typeof graphRunLogSchema>, 'component'>
): void {
  emitValidatedLog(
    graphRunLogSchema,
    {
      component: 'jobs-worker',
      ...payload,
    },
    log
  );
}

async function resolveEntityId(
  prisma: PrismaClient,
  author: { authorId: string | null; authorName: string }
): Promise<string> {
  if (author.authorId) {
    const exact = await prisma.entity.findFirst({
      where: {
        kind: 'author',
        externalId: author.authorId,
      },
      select: { id: true },
    });
    if (exact) {
      return exact.id;
    }
  }

  const normalized = normalizeName(author.authorName);
  if (normalized) {
    const token = normalized.split(' ')[0] || normalized;
    const candidates = await prisma.entity.findMany({
      where: {
        kind: 'author',
        externalId: null,
        name: { contains: token, mode: 'insensitive' },
      },
      take: 5,
      select: { id: true, name: true },
    });
    const exactNormalized = candidates.filter(
      (candidate) => normalizeName(candidate.name) === normalized
    );
    if (exactNormalized.length === 1) {
      const match = exactNormalized.at(0);
      if (match) {
        return match.id;
      }
    }
  }

  const created = await prisma.entity.create({
    data: {
      kind: 'author',
      name: author.authorName,
      externalId: author.authorId,
    },
    select: { id: true },
  });
  return created.id;
}

async function enqueueObjectReady(graphQueue: Queue, objectId: string): Promise<void> {
  const payload = objectReadyJobPayloadSchema.parse({
    objectId,
    source: 'openalex',
  });
  const jobId = buildObjectReadyJobId(payload.objectId);
  await addJobIfMissing(
    graphQueue,
    OBJECT_READY_JOB_NAME,
    payload,
    createStandardJobOptions(jobId, 3)
  );
}

export async function runGraphResolveObject(
  deps: GraphResolverDeps,
  payloadInput: unknown
): Promise<void> {
  const payload = objectCreatedJobPayloadSchema.parse(payloadInput);
  const startedAt = Date.now();
  const depth = await readQueueDepth(deps.graphQueue);
  const queueDepth = { graph: depth };
  const object = await deps.prisma.researchObject.findUnique({
    where: { id: payload.objectId },
    select: objectSelect,
  });
  if (!object) {
    emitLog(deps.log, {
      state: 'degraded',
      objectId: payload.objectId,
      attempt: 1,
      durationMs: Date.now() - startedAt,
      reason: 'Research object not found for graph resolution.',
      linkedCount: 0,
      queueDepth,
    });
    return;
  }

  let parsedMetadata = sourceMetadataSchema.safeParse(object.sourceMetadata);
  if (!parsedMetadata.success) {
    emitLog(deps.log, {
      state: 'degraded',
      objectId: payload.objectId,
      attempt: 1,
      durationMs: Date.now() - startedAt,
      reason: 'Research object source metadata is malformed.',
      linkedCount: 0,
      queueDepth,
    });
    parsedMetadata = { success: true, data: { authorships: [] } };
  }

  let linkedCount = 0;
  for (const authorship of parsedMetadata.data.authorships) {
    const entityId = await resolveEntityId(deps.prisma, authorship);
    await deps.prisma.objectEntity.upsert({
      where: {
        objectId_entityId_role: {
          objectId: payload.objectId,
          entityId,
          role: 'author',
        },
      },
      create: {
        objectId: payload.objectId,
        entityId,
        role: 'author',
        position: authorship.position,
      },
      update: {
        position: authorship.position,
      },
      select: { id: true },
    });
    linkedCount += 1;
  }

  await enqueueObjectReady(deps.graphQueue, payload.objectId);
  emitLog(deps.log, {
    state: 'ready',
    objectId: payload.objectId,
    attempt: 1,
    durationMs: Date.now() - startedAt,
    linkedCount,
    queueDepth,
  });
}
