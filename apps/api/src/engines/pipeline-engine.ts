import {
  pipelineAddCardsBatchInputSchema,
  pipelineAddCardsBatchOutputSchema,
  pipelineAddCardInputSchema,
  pipelineBoardSchema,
  pipelineCreateInputSchema,
  pipelineDeleteInputSchema,
  pipelineDeleteOutputSchema,
  pipelineGetBoardInputSchema,
  pipelineMoveCardInputSchema,
  pipelineRemoveCardInputSchema,
  pipelineRemoveCardsBatchInputSchema,
  pipelineRemoveCardsBatchOutputSchema,
  pipelinesListInputSchema,
  pipelineSummarySchema,
  pipelineUpdateInputSchema,
  type PipelineAddCardsBatchInput,
  type PipelineAddCardInput,
  type PipelineCreateInput,
  type PipelineDeleteInput,
  type PipelineGetBoardInput,
  type PipelineMoveCardInput,
  type PipelineRemoveCardsBatchInput,
  type PipelineRemoveCardInput,
  type PipelinesListInput,
  type PipelineUpdateInput,
} from '@paperscraper/shared';
import { TRPCError } from '@trpc/server';

export interface PipelineEngineDeps {
  listPipelines: () => Promise<unknown[]>;
  createPipeline: (input: PipelineCreateInput) => Promise<unknown>;
  updatePipeline: (input: PipelineUpdateInput) => Promise<unknown | null>;
  deletePipeline: (pipelineId: string) => Promise<unknown | null>;
  getBoard: (pipelineId?: string) => Promise<unknown>;
  addCard: (input: PipelineAddCardInput) => Promise<unknown>;
  addCardsBatch: (input: PipelineAddCardsBatchInput) => Promise<unknown>;
  moveCard: (input: PipelineMoveCardInput) => Promise<unknown>;
  removeCard: (input: PipelineRemoveCardInput) => Promise<unknown>;
  removeCardsBatch: (input: PipelineRemoveCardsBatchInput) => Promise<unknown>;
}

export function createPipelineEngine(deps: PipelineEngineDeps) {
  return {
    async list(input: PipelinesListInput) {
      pipelinesListInputSchema.parse(input);
      const pipelines = await deps.listPipelines();
      return pipelines.map((pipeline) => pipelineSummarySchema.parse(pipeline));
    },

    async create(input: PipelineCreateInput) {
      const parsed = pipelineCreateInputSchema.parse(input);
      const created = await deps.createPipeline(parsed);
      return pipelineSummarySchema.parse(created);
    },

    async update(input: PipelineUpdateInput) {
      const parsed = pipelineUpdateInputSchema.parse(input);
      const updated = await deps.updatePipeline(parsed);
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found.' });
      }
      return pipelineSummarySchema.parse(updated);
    },

    async delete(input: PipelineDeleteInput) {
      const parsed = pipelineDeleteInputSchema.parse(input);
      const deleted = await deps.deletePipeline(parsed.id);
      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Pipeline not found.' });
      }
      return pipelineDeleteOutputSchema.parse(deleted);
    },

    async getBoard(input: PipelineGetBoardInput) {
      const parsed = pipelineGetBoardInputSchema.parse(input);
      const board = await deps.getBoard(parsed.pipelineId);
      return pipelineBoardSchema.parse(board);
    },

    async addCard(input: PipelineAddCardInput) {
      const parsed = pipelineAddCardInputSchema.parse(input);
      const board = await deps.addCard(parsed);
      return pipelineBoardSchema.parse(board);
    },

    async addCardsBatch(input: PipelineAddCardsBatchInput) {
      const parsed = pipelineAddCardsBatchInputSchema.parse(input);
      const result = await deps.addCardsBatch(parsed);
      return pipelineAddCardsBatchOutputSchema.parse(result);
    },

    async moveCard(input: PipelineMoveCardInput) {
      const parsed = pipelineMoveCardInputSchema.parse(input);
      const board = await deps.moveCard(parsed);
      return pipelineBoardSchema.parse(board);
    },

    async removeCard(input: PipelineRemoveCardInput) {
      const parsed = pipelineRemoveCardInputSchema.parse(input);
      const board = await deps.removeCard(parsed);
      return pipelineBoardSchema.parse(board);
    },

    async removeCardsBatch(input: PipelineRemoveCardsBatchInput) {
      const parsed = pipelineRemoveCardsBatchInputSchema.parse(input);
      const result = await deps.removeCardsBatch(parsed);
      return pipelineRemoveCardsBatchOutputSchema.parse(result);
    },
  };
}

export type PipelineEngine = ReturnType<typeof createPipelineEngine>;
