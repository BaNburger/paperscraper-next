import type { PipelineBoard, PipelineUpdateInput } from '@paperscraper/shared/browser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asClientErrorMessage } from '../../lib/api/errors';
import {
  addPipelineCard,
  createPipeline,
  deletePipeline,
  movePipelineCard,
  removePipelineCard,
  updatePipeline,
} from '../../lib/api/pipelines';
import { queryKeys } from '../query/keys';
import { applyOptimisticMove } from './pipeline-dnd';

interface UsePipelineMutationsArgs {
  onError: (message: string) => void;
}

export function usePipelineBoardMutations({ onError }: UsePipelineMutationsArgs) {
  const queryClient = useQueryClient();

  const createPipelineMutation = useMutation({
    mutationFn: (name: string) => createPipeline({ name }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pipelines() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.pipelineBoard(undefined) });
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Could not create pipeline.')),
  });

  const deletePipelineMutation = useMutation({
    mutationFn: (id: string) => deletePipeline(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pipelines() });
      await queryClient.invalidateQueries({ queryKey: ['pipelines', 'board'] });
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Could not delete pipeline.')),
  });

  const updatePipelineMutation = useMutation({
    mutationFn: (input: PipelineUpdateInput) => updatePipeline(input),
    onSuccess: async (_next, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.pipelines() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pipelineBoard(input.id) }),
      ]);
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Could not update pipeline.')),
  });

  const addCardMutation = useMutation({
    mutationFn: (input: { pipelineId: string; stageId: string; objectId: string }) =>
      addPipelineCard(input),
    onSuccess: (next, input) => {
      queryClient.setQueryData(queryKeys.pipelineBoard(input.pipelineId), next);
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Could not add card.')),
  });

  const removeCardMutation = useMutation({
    mutationFn: (input: { pipelineId: string; cardId: string }) => removePipelineCard(input),
    onSuccess: (next, input) => {
      queryClient.setQueryData(queryKeys.pipelineBoard(input.pipelineId), next);
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Could not remove card.')),
  });

  const moveCardMutation = useMutation({
    mutationFn: (input: {
      pipelineId: string;
      cardId: string;
      toStageId: string;
      toPosition: number;
    }) => movePipelineCard(input),
    onMutate: async (input) => {
      const key = queryKeys.pipelineBoard(input.pipelineId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PipelineBoard>(key);
      if (previous) {
        queryClient.setQueryData(
          key,
          applyOptimisticMove(previous, input.cardId, {
            toStageId: input.toStageId,
            toPosition: input.toPosition,
          })
        );
      }
      return { key, previous };
    },
    onError: (cause, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
      onError(asClientErrorMessage(cause, 'Could not move card. State was rolled back.'));
    },
    onSuccess: (next, input) => {
      queryClient.setQueryData(queryKeys.pipelineBoard(input.pipelineId), next);
    },
    onSettled: async (_next, _error, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pipelineBoard(input.pipelineId) });
    },
  });

  return {
    pending:
      createPipelineMutation.isPending ||
      deletePipelineMutation.isPending ||
      updatePipelineMutation.isPending ||
      addCardMutation.isPending ||
      removeCardMutation.isPending ||
      moveCardMutation.isPending,
    createPipeline: createPipelineMutation.mutateAsync,
    deletePipeline: deletePipelineMutation.mutateAsync,
    updatePipeline: updatePipelineMutation.mutateAsync,
    addCard: addCardMutation.mutateAsync,
    removeCard: removeCardMutation.mutateAsync,
    moveCard: moveCardMutation.mutateAsync,
  };
}
