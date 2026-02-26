import {
  dimensionCreateInputSchema,
  dimensionDeleteInputSchema,
  dimensionsListInputSchema,
  dimensionSchema,
  dimensionUpdateInputSchema,
  scoreBackfillDimensionInputSchema,
  scoreBackfillKickoffSchema,
  type DimensionCreateInput,
  type DimensionDeleteInput,
  type DimensionsListInput,
  type DimensionUpdateInput,
  type ScoreBackfillDimensionInput,
} from '@paperscraper/shared';
import { TRPCError } from '@trpc/server';

type DimensionRow = {
  id: string;
  name: string;
  prompt: string;
  provider: 'openai' | 'anthropic';
  model: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type DimensionPatch = {
  name?: string;
  prompt?: string;
  provider?: 'openai' | 'anthropic';
  model?: string;
  isActive?: boolean;
};

export interface ScoringEngineDeps {
  listDimensions: (includeInactive: boolean) => Promise<DimensionRow[]>;
  createDimension: (input: DimensionCreateInput) => Promise<DimensionRow>;
  getDimensionById: (id: string) => Promise<DimensionRow | null>;
  updateDimension: (id: string, patch: DimensionPatch) => Promise<DimensionRow>;
  enqueueBackfillDimension: (dimensionId: string) => Promise<string>;
}

function toDimensionDto(row: DimensionRow) {
  return dimensionSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export function createScoringEngine(deps: ScoringEngineDeps) {
  return {
    async list(input: DimensionsListInput) {
      const parsed = dimensionsListInputSchema.parse(input);
      const rows = await deps.listDimensions(parsed.includeInactive);
      return rows.map(toDimensionDto);
    },

    async create(input: DimensionCreateInput) {
      const parsed = dimensionCreateInputSchema.parse(input);
      const created = await deps.createDimension(parsed);
      return toDimensionDto(created);
    },

    async update(input: DimensionUpdateInput) {
      const parsed = dimensionUpdateInputSchema.parse(input);
      const existing = await deps.getDimensionById(parsed.id);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Dimension not found.' });
      }
      const updated = await deps.updateDimension(parsed.id, {
        name: parsed.name,
        prompt: parsed.prompt,
        provider: parsed.provider,
        model: parsed.model,
        isActive: parsed.isActive,
      });
      return toDimensionDto(updated);
    },

    async delete(input: DimensionDeleteInput) {
      const parsed = dimensionDeleteInputSchema.parse(input);
      const existing = await deps.getDimensionById(parsed.id);
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Dimension not found.' });
      }
      const deleted = await deps.updateDimension(parsed.id, { isActive: false });
      return toDimensionDto(deleted);
    },

    async backfillDimension(input: ScoreBackfillDimensionInput) {
      const parsed = scoreBackfillDimensionInputSchema.parse(input);
      const dimension = await deps.getDimensionById(parsed.dimensionId);
      if (!dimension) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Dimension not found.' });
      }
      if (!dimension.isActive) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Dimension is inactive.' });
      }
      const jobId = await deps.enqueueBackfillDimension(parsed.dimensionId);
      return scoreBackfillKickoffSchema.parse({
        dimensionId: parsed.dimensionId,
        jobId,
        status: 'queued',
        queuedAt: new Date().toISOString(),
      });
    },
  };
}

export type ScoringEngine = ReturnType<typeof createScoringEngine>;
