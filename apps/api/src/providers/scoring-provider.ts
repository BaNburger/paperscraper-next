import type { PrismaClient } from '@paperscraper/db';
import type { Queue } from 'bullmq';
import {
  SCORE_BACKFILL_DIMENSION_JOB_NAME,
  buildScoreBackfillDimensionJobId,
  scoreBackfillDimensionJobPayloadSchema,
  type DimensionCreateInput,
} from '@paperscraper/shared';

type DimensionPatch = {
  name?: string;
  prompt?: string;
  provider?: 'openai' | 'anthropic';
  model?: string;
  isActive?: boolean;
};

const dimensionSelect = {
  id: true,
  name: true,
  prompt: true,
  provider: true,
  model: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isDuplicateJobError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes('job') && message.includes('exists');
}

export interface ScoringProviderDeps {
  listDimensions: (includeInactive: boolean) => Promise<
    Array<{
      id: string;
      name: string;
      prompt: string;
      provider: 'openai' | 'anthropic';
      model: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>
  >;
  createDimension: (input: DimensionCreateInput) => Promise<{
    id: string;
    name: string;
    prompt: string;
    provider: 'openai' | 'anthropic';
    model: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  getDimensionById: (id: string) => Promise<{
    id: string;
    name: string;
    prompt: string;
    provider: 'openai' | 'anthropic';
    model: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  } | null>;
  updateDimension: (id: string, patch: DimensionPatch) => Promise<{
    id: string;
    name: string;
    prompt: string;
    provider: 'openai' | 'anthropic';
    model: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }>;
  enqueueBackfillDimension: (dimensionId: string) => Promise<string>;
}

export function createScoringProvider(
  prisma: PrismaClient,
  graphQueue: Queue
): ScoringProviderDeps {
  return {
    listDimensions: async (includeInactive) => {
      const where = includeInactive ? {} : { isActive: true };
      const rows = await prisma.dimension.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: dimensionSelect,
      });
      return rows.map((row) => ({ ...row, provider: row.provider }));
    },

    createDimension: async (input) => {
      const created = await prisma.dimension.create({
        data: {
          name: input.name,
          prompt: input.prompt,
          provider: input.provider,
          model: input.model,
          isActive: input.isActive,
        },
        select: dimensionSelect,
      });
      return { ...created, provider: created.provider };
    },

    getDimensionById: async (id) => {
      const row = await prisma.dimension.findUnique({
        where: { id },
        select: dimensionSelect,
      });
      return row ? { ...row, provider: row.provider } : null;
    },

    updateDimension: async (id, patch) => {
      const updated = await prisma.dimension.update({
        where: { id },
        data: patch,
        select: dimensionSelect,
      });
      return { ...updated, provider: updated.provider };
    },

    enqueueBackfillDimension: async (dimensionId) => {
      const payload = scoreBackfillDimensionJobPayloadSchema.parse({ dimensionId });
      const jobId = buildScoreBackfillDimensionJobId(payload.dimensionId);
      const existing = await graphQueue.getJob(jobId);
      if (existing) {
        return jobId;
      }
      try {
        await graphQueue.add(SCORE_BACKFILL_DIMENSION_JOB_NAME, payload, {
          jobId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 500 },
          removeOnComplete: true,
          removeOnFail: false,
        });
      } catch (error) {
        if (!isDuplicateJobError(error)) {
          throw error;
        }
      }
      return jobId;
    },
  };
}
