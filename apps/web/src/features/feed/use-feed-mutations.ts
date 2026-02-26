import type { ScoringProvider, StreamCreateInput, StreamUpdateInput } from '@paperscraper/shared/browser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asClientErrorMessage } from '../../lib/api/errors';
import { revokeApiKey, upsertApiKey } from '../../lib/api/api-keys';
import { addPipelineCard, getPipelineBoard } from '../../lib/api/pipelines';
import { createStream, triggerStream, updateStream } from '../../lib/api/streams';
import { queryKeys } from '../query/keys';

interface UseFeedMutationsArgs {
  onError: (message: string) => void;
}

export function useFeedMutations({ onError }: UseFeedMutationsArgs) {
  const queryClient = useQueryClient();

  const createStreamMutation = useMutation({
    mutationFn: (input: StreamCreateInput) => createStream(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.streams() });
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to create stream.')),
  });

  const updateStreamMutation = useMutation({
    mutationFn: (input: StreamUpdateInput) => updateStream(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.streams() });
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to update stream.')),
  });

  const triggerStreamMutation = useMutation({
    mutationFn: (id: string) => triggerStream(id),
    onSuccess: async (_run, streamId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.streamRuns(streamId, 10) }),
        queryClient.invalidateQueries({ queryKey: ['objects', 'feed'] }),
      ]);
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to trigger stream.')),
  });

  const addToPipelineMutation = useMutation({
    mutationFn: async (input: {
      objectId: string;
      pipelineId?: string;
      preferredStageId?: string;
    }) => {
      if (!input.pipelineId) {
        throw new Error('Select a pipeline first.');
      }
      let stageId = input.preferredStageId;
      if (!stageId) {
        const board = await getPipelineBoard(input.pipelineId);
        stageId = board.stages[0]?.id;
      }
      if (!stageId) {
        throw new Error('Selected pipeline has no stages.');
      }
      return addPipelineCard({
        pipelineId: input.pipelineId,
        stageId,
        objectId: input.objectId,
      });
    },
    onSuccess: async (_board, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['objects', 'feed'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pipelineBoard(input.pipelineId) }),
      ]);
    },
    onError: (cause) =>
      onError(asClientErrorMessage(cause, 'Failed to add card to pipeline.')),
  });

  const upsertApiKeyMutation = useMutation({
    mutationFn: (input: { provider: ScoringProvider; apiKey: string }) =>
      upsertApiKey(input.provider, input.apiKey),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeyProviders() });
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to save API key.')),
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: (provider: ScoringProvider) => revokeApiKey(provider),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.apiKeyProviders() });
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to revoke API key.')),
  });

  return {
    pending:
      createStreamMutation.isPending ||
      updateStreamMutation.isPending ||
      triggerStreamMutation.isPending ||
      addToPipelineMutation.isPending ||
      upsertApiKeyMutation.isPending ||
      revokeApiKeyMutation.isPending,
    createStream: createStreamMutation.mutateAsync,
    updateStream: updateStreamMutation.mutateAsync,
    triggerStream: triggerStreamMutation.mutateAsync,
    addToPipeline: addToPipelineMutation.mutateAsync,
    upsertApiKey: upsertApiKeyMutation.mutateAsync,
    revokeApiKey: revokeApiKeyMutation.mutateAsync,
  };
}
