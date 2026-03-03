import {
  pipelineAddCardsBatchInputSchema,
  pipelineAddCardsBatchOutputSchema,
  pipelineAddCardInputSchema,
  pipelineBoardSchema,
  pipelineCreateInputSchema,
  pipelineDeleteInputSchema,
  pipelineDeleteOutputSchema,
  pipelineMoveCardInputSchema,
  pipelineRemoveCardsBatchInputSchema,
  pipelineRemoveCardsBatchOutputSchema,
  pipelineRemoveCardInputSchema,
  pipelineSummarySchema,
  pipelineUpdateInputSchema,
  pipelinesListInputSchema,
  type PipelineAddCardsBatchInput,
  type PipelineAddCardsBatchOutput,
  type PipelineAddCardInput,
  type PipelineBoard,
  type PipelineCreateInput,
  type PipelineDeleteOutput,
  type PipelineMoveCardInput,
  type PipelineRemoveCardsBatchInput,
  type PipelineRemoveCardsBatchOutput,
  type PipelineRemoveCardInput,
  type PipelineSummary,
  type PipelineUpdateInput,
} from '@paperscraper/shared/browser';
import { z } from 'zod';
import { trpcMutation, trpcQuery } from './trpc';

export async function listPipelines(): Promise<PipelineSummary[]> {
  return trpcQuery('pipelines.list', pipelinesListInputSchema.parse({}), z.array(pipelineSummarySchema));
}

export async function createPipeline(input: PipelineCreateInput): Promise<PipelineSummary> {
  return trpcMutation('pipelines.create', pipelineCreateInputSchema.parse(input), pipelineSummarySchema);
}

export async function updatePipeline(input: PipelineUpdateInput): Promise<PipelineSummary> {
  return trpcMutation('pipelines.update', pipelineUpdateInputSchema.parse(input), pipelineSummarySchema);
}

export async function deletePipeline(id: string): Promise<PipelineDeleteOutput> {
  return trpcMutation(
    'pipelines.delete',
    pipelineDeleteInputSchema.parse({ id }),
    pipelineDeleteOutputSchema
  );
}

export async function getPipelineBoard(pipelineId?: string): Promise<PipelineBoard> {
  return trpcQuery(
    'pipelines.getBoard',
    pipelineId ? { pipelineId } : {},
    pipelineBoardSchema
  );
}

export async function addPipelineCard(input: PipelineAddCardInput): Promise<PipelineBoard> {
  return trpcMutation('pipelines.addCard', pipelineAddCardInputSchema.parse(input), pipelineBoardSchema);
}

export async function addPipelineCardsBatch(
  input: PipelineAddCardsBatchInput
): Promise<PipelineAddCardsBatchOutput> {
  return trpcMutation(
    'pipelines.addCardsBatch',
    pipelineAddCardsBatchInputSchema.parse(input),
    pipelineAddCardsBatchOutputSchema
  );
}

export async function movePipelineCard(input: PipelineMoveCardInput): Promise<PipelineBoard> {
  return trpcMutation('pipelines.moveCard', pipelineMoveCardInputSchema.parse(input), pipelineBoardSchema);
}

export async function removePipelineCard(input: PipelineRemoveCardInput): Promise<PipelineBoard> {
  return trpcMutation(
    'pipelines.removeCard',
    pipelineRemoveCardInputSchema.parse(input),
    pipelineBoardSchema
  );
}

export async function removePipelineCardsBatch(
  input: PipelineRemoveCardsBatchInput
): Promise<PipelineRemoveCardsBatchOutput> {
  return trpcMutation(
    'pipelines.removeCardsBatch',
    pipelineRemoveCardsBatchInputSchema.parse(input),
    pipelineRemoveCardsBatchOutputSchema
  );
}
