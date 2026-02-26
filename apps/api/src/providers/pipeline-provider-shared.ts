import type { PrismaClient } from '@paperscraper/db';
import type { PipelineBoard, PipelineCreateInput, PipelineSummary } from '@paperscraper/shared';

export const DEFAULT_PIPELINE_NAME = 'Default Pipeline';
export const DEFAULT_STAGE_NAMES = ['Inbox', 'Review', 'Decision'];

type PipelineSummaryRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeStageNames(value?: string[]): string[] {
  const source = value && value.length > 0 ? value : DEFAULT_STAGE_NAMES;
  const deduped = new Set<string>();
  for (const raw of source) {
    const name = raw.trim();
    if (!name || deduped.has(name)) {
      continue;
    }
    deduped.add(name);
  }
  return deduped.size > 0 ? Array.from(deduped) : [...DEFAULT_STAGE_NAMES];
}

export function toPipelineSummary(row: PipelineSummaryRow): PipelineSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function clampPosition(position: number | undefined, length: number): number {
  if (position === undefined) {
    return length;
  }
  return Math.max(0, Math.min(position, length));
}

export async function createPipelineWithStages(
  prisma: PrismaClient,
  input: Pick<PipelineCreateInput, 'name' | 'description' | 'stageNames'>
): Promise<PipelineSummaryRow> {
  const stageNames = normalizeStageNames(input.stageNames);
  const created = await prisma.pipeline.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      stages: {
        createMany: {
          data: stageNames.map((name, position) => ({ name, position })),
        },
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return created;
}

export async function getBoardByPipelineId(
  prisma: PrismaClient,
  pipelineId: string
): Promise<PipelineBoard | null> {
  const row = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      stages: {
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          position: true,
          pipelineId: true,
          cards: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              pipelineId: true,
              stageId: true,
              objectId: true,
              position: true,
              object: {
                select: {
                  id: true,
                  title: true,
                  publishedAt: true,
                  scores: { select: { value: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!row) {
    return null;
  }
  return {
    pipeline: toPipelineSummary(row),
    stages: row.stages.map((stage) => ({
      id: stage.id,
      pipelineId: stage.pipelineId,
      name: stage.name,
      position: stage.position,
      cards: stage.cards.map((card) => ({
        id: card.id,
        pipelineId: card.pipelineId,
        stageId: card.stageId,
        objectId: card.objectId,
        position: card.position,
        object: {
          id: card.object.id,
          title: card.object.title,
          publishedAt: card.object.publishedAt ? card.object.publishedAt.toISOString() : null,
          topScore:
            card.object.scores.length > 0
              ? Math.max(...card.object.scores.map((score) => score.value))
              : null,
        },
      })),
    })),
  };
}

export async function ensureBoardPipeline(
  prisma: PrismaClient,
  pipelineId?: string
): Promise<string> {
  if (pipelineId) {
    return pipelineId;
  }
  const existing = await prisma.pipeline.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }
  const created = await createPipelineWithStages(prisma, {
    name: DEFAULT_PIPELINE_NAME,
    description: null,
    stageNames: DEFAULT_STAGE_NAMES,
  });
  return created.id;
}

export async function assertStage(
  prisma: Pick<PrismaClient, 'pipelineStage'>,
  pipelineId: string,
  stageId: string
): Promise<void> {
  const stage = await prisma.pipelineStage.findFirst({
    where: { id: stageId, pipelineId },
    select: { id: true },
  });
  if (!stage) {
    throw new Error('Stage not found for pipeline.');
  }
}
