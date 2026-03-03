import { useMemo } from 'react';
import type { ObjectsFeedInput } from '@paperscraper/shared/browser';
import { useQuery } from '@tanstack/react-query';
import { apiKeyProvidersQueryOptions } from '../api-keys/queries';
import { pipelineBoardQueryOptions, pipelinesListQueryOptions } from '../pipeline/queries';
import {
  workspaceFeedPreferencesQueryOptions,
  workspaceSavedViewsQueryOptions,
} from '../workspace/queries';
import { streamRunsQueryOptions, streamsListQueryOptions } from '../streams/queries';
import { feedQueryOptions } from './queries';
import type { FeedPaneTab, StageOption } from './types';

const EMPTY_ARRAY: [] = [];

function asErrorMessage(value: unknown): string | null {
  if (value instanceof Error && value.message.trim().length > 0) {
    return value.message;
  }
  return null;
}

interface UseFeedDataArgs {
  feedInput: ObjectsFeedInput;
  pipelineId?: string;
  selectedStreamId?: string;
  pane: FeedPaneTab;
}

export function useFeedData({
  feedInput,
  pipelineId,
  selectedStreamId,
  pane,
}: UseFeedDataArgs) {
  const feedQuery = useQuery(feedQueryOptions(feedInput));
  const streamsQuery = useQuery(streamsListQueryOptions());
  const pipelinesQuery = useQuery(pipelinesListQueryOptions());
  const stagesQuery = useQuery({
    ...pipelineBoardQueryOptions(pipelineId),
    enabled: Boolean(pipelineId),
  });
  const streamRunsQuery = useQuery({
    ...streamRunsQueryOptions(selectedStreamId || '', 10),
    enabled: Boolean(selectedStreamId),
  });
  const apiKeysQuery = useQuery({
    ...apiKeyProvidersQueryOptions(),
    enabled: pane === 'apiKeys',
  });
  const savedViewsQuery = useQuery(workspaceSavedViewsQueryOptions());
  const preferencesQuery = useQuery(workspaceFeedPreferencesQueryOptions());
  const streams = streamsQuery.data ?? EMPTY_ARRAY;
  const pipelines = pipelinesQuery.data ?? EMPTY_ARRAY;
  const streamRuns = streamRunsQuery.data ?? EMPTY_ARRAY;
  const apiKeyProviders = apiKeysQuery.data ?? EMPTY_ARRAY;
  const savedViews = savedViewsQuery.data ?? EMPTY_ARRAY;

  const loading = feedQuery.isLoading || streamsQuery.isLoading || pipelinesQuery.isLoading;

  const stageOptions = useMemo<StageOption[]>(
    () => stagesQuery.data?.stages.map((stage) => ({ id: stage.id, name: stage.name })) || [],
    [stagesQuery.data]
  );

  const queryError =
    asErrorMessage(feedQuery.error) ||
    asErrorMessage(streamsQuery.error) ||
    asErrorMessage(pipelinesQuery.error) ||
    asErrorMessage(stagesQuery.error) ||
    asErrorMessage(streamRunsQuery.error) ||
    asErrorMessage(apiKeysQuery.error) ||
    asErrorMessage(savedViewsQuery.error) ||
    asErrorMessage(preferencesQuery.error);

  return {
    loading,
    queryError,
    feed: feedQuery.data,
    streams,
    streamRuns,
    pipelines,
    stageOptions,
    apiKeyProviders,
    savedViews,
    preferences: preferencesQuery.data,
    refetchFeed: feedQuery.refetch,
  };
}
