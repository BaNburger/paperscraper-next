import type {
  FeedSavedView,
  ScoringProvider,
  StreamCreateInput,
  StreamUpdateInput,
  WorkspaceFeedPreferences,
  WorkspaceSavedViewCreateInput,
} from '@paperscraper/shared/browser';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { asClientErrorMessage } from '../../lib/api/errors';
import { revokeApiKey, upsertApiKey } from '../../lib/api/api-keys';
import {
  addPipelineCard,
  addPipelineCardsBatch,
  getPipelineBoard,
  removePipelineCardsBatch,
} from '../../lib/api/pipelines';
import { createStream, triggerStream, updateStream } from '../../lib/api/streams';
import {
  createWorkspaceSavedView,
  deleteWorkspaceSavedView,
  updateWorkspaceSavedView,
  upsertWorkspaceFeedPreferences,
} from '../../lib/api/workspace';
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

  const addBatchToPipelineMutation = useMutation({
    mutationFn: async (input: {
      objectIds: string[];
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
      return addPipelineCardsBatch({
        pipelineId: input.pipelineId,
        stageId,
        objectIds: input.objectIds,
      });
    },
    onSuccess: async (_result, input) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['objects', 'feed'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.pipelineBoard(input.pipelineId) }),
      ]);
    },
    onError: (cause) =>
      onError(asClientErrorMessage(cause, 'Failed to add selected cards to pipeline.')),
  });

  const removeBatchCardsMutation = useMutation({
    mutationFn: (input: { pipelineId: string; cardIds: string[] }) => removePipelineCardsBatch(input),
    onSuccess: async (_result, input) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pipelineBoard(input.pipelineId) });
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to undo batch action.')),
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

  const createSavedViewMutation = useMutation({
    mutationFn: (input: WorkspaceSavedViewCreateInput) => createWorkspaceSavedView(input),
    onSuccess: async (savedView) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaceSavedViews() });
      await queryClient.setQueryData<FeedSavedView[]>(
        queryKeys.workspaceSavedViews(),
        (current) => [savedView, ...(current ?? [])]
      );
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to create saved view.')),
  });

  const updateSavedViewMutation = useMutation({
    mutationFn: (input: { id: string; name?: string; definition?: WorkspaceSavedViewCreateInput['definition'] }) =>
      updateWorkspaceSavedView(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaceSavedViews() });
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to update saved view.')),
  });

  const deleteSavedViewMutation = useMutation({
    mutationFn: (id: string) => deleteWorkspaceSavedView(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workspaceSavedViews() });
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to delete saved view.')),
  });

  const upsertPreferencesMutation = useMutation({
    mutationFn: (input: WorkspaceFeedPreferences) => upsertWorkspaceFeedPreferences(input),
    onSuccess: async (value) => {
      await queryClient.setQueryData(queryKeys.workspaceFeedPreferences(), value);
    },
    onError: (cause) => onError(asClientErrorMessage(cause, 'Failed to save layout preferences.')),
  });

  return {
    pending:
      createStreamMutation.isPending ||
      updateStreamMutation.isPending ||
      triggerStreamMutation.isPending ||
      addToPipelineMutation.isPending ||
      addBatchToPipelineMutation.isPending ||
      removeBatchCardsMutation.isPending ||
      upsertApiKeyMutation.isPending ||
      revokeApiKeyMutation.isPending ||
      createSavedViewMutation.isPending ||
      updateSavedViewMutation.isPending ||
      deleteSavedViewMutation.isPending ||
      upsertPreferencesMutation.isPending,
    createStream: createStreamMutation.mutateAsync,
    updateStream: updateStreamMutation.mutateAsync,
    triggerStream: triggerStreamMutation.mutateAsync,
    addToPipeline: addToPipelineMutation.mutateAsync,
    addBatchToPipeline: addBatchToPipelineMutation.mutateAsync,
    removeBatchCards: removeBatchCardsMutation.mutateAsync,
    upsertApiKey: upsertApiKeyMutation.mutateAsync,
    revokeApiKey: revokeApiKeyMutation.mutateAsync,
    createSavedView: createSavedViewMutation.mutateAsync,
    updateSavedView: updateSavedViewMutation.mutateAsync,
    deleteSavedView: deleteSavedViewMutation.mutateAsync,
    upsertPreferences: upsertPreferencesMutation.mutateAsync,
  };
}
