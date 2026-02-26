import type { PrismaClient } from '@paperscraper/db';
import type { EntityDetailOutput, ObjectDetailOutput } from '@paperscraper/shared';

function normalizeDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function asScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export async function getObjectDetail(
  prisma: PrismaClient,
  objectId: string
): Promise<ObjectDetailOutput | null> {
  const row = await prisma.researchObject.findUnique({
    where: { id: objectId },
    select: {
      id: true,
      externalId: true,
      source: true,
      title: true,
      abstract: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      scores: {
        orderBy: [{ value: 'desc' }, { updatedAt: 'desc' }],
        select: {
          dimensionId: true,
          value: true,
          explanation: true,
          metadata: true,
          updatedAt: true,
          dimension: { select: { name: true } },
        },
      },
      objectLinks: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: {
          role: true,
          position: true,
          entity: {
            select: { id: true, name: true, kind: true, externalId: true },
          },
        },
      },
      pipelineCard: {
        orderBy: [{ stage: { position: 'asc' } }, { position: 'asc' }],
        select: {
          id: true,
          position: true,
          pipeline: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    externalId: row.externalId,
    source: 'openalex',
    title: row.title,
    abstract: row.abstract ?? null,
    publishedAt: normalizeDate(row.publishedAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    scores: row.scores.map((score) => ({
      dimensionId: score.dimensionId,
      dimensionName: score.dimension.name,
      value: asScore(score.value),
      explanation: score.explanation,
      metadata: score.metadata ?? undefined,
      updatedAt: score.updatedAt.toISOString(),
    })),
    entities: row.objectLinks.map((link) => ({
      entityId: link.entity.id,
      name: link.entity.name,
      kind: link.entity.kind,
      externalId: link.entity.externalId ?? null,
      role: link.role,
      position: link.position ?? null,
    })),
    pipelineCards: row.pipelineCard.map((card) => ({
      cardId: card.id,
      pipelineId: card.pipeline.id,
      pipelineName: card.pipeline.name,
      stageId: card.stage.id,
      stageName: card.stage.name,
      position: card.position,
    })),
  };
}

export async function getEntityDetail(
  prisma: PrismaClient,
  entityId: string
): Promise<EntityDetailOutput | null> {
  const entity = await prisma.entity.findUnique({
    where: { id: entityId },
    select: {
      id: true,
      name: true,
      kind: true,
      externalId: true,
      createdAt: true,
      updatedAt: true,
      scores: {
        orderBy: [{ value: 'desc' }, { updatedAt: 'desc' }],
        select: {
          dimensionId: true,
          value: true,
          explanation: true,
          metadata: true,
          updatedAt: true,
          dimension: { select: { name: true } },
        },
      },
      objectLinks: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: {
          role: true,
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
  });
  if (!entity) {
    return null;
  }

  return {
    id: entity.id,
    name: entity.name,
    kind: entity.kind,
    externalId: entity.externalId ?? null,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    scores: entity.scores.map((score) => ({
      dimensionId: score.dimensionId,
      dimensionName: score.dimension.name,
      value: asScore(score.value),
      explanation: score.explanation,
      metadata: score.metadata ?? undefined,
      updatedAt: score.updatedAt.toISOString(),
    })),
    relatedObjects: entity.objectLinks.map((link) => ({
      objectId: link.object.id,
      title: link.object.title,
      publishedAt: normalizeDate(link.object.publishedAt),
      topScore:
        link.object.scores.length > 0
          ? asScore(Math.max(...link.object.scores.map((score) => score.value)))
          : null,
      role: link.role,
      position: link.position ?? null,
    })),
  };
}
