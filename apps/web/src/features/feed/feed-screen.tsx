import { useEffect, useMemo, useState } from 'react';
import type { ScoringProvider } from '@paperscraper/shared/browser';
import { asClientErrorMessage } from '../../lib/api/errors';
import { FeedView } from './feed-view';
import { useFeedData } from './use-feed-data';
import { useFeedMutations } from './use-feed-mutations';
import { useFeedQueryState } from './use-feed-query-state';
import type { FeedPaneTab, StreamDraft } from './types';

function parseMaxObjects(value: string, fallback = 100): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

export function FeedScreen() {
  const queryState = useFeedQueryState();
  const [pane, setPane] = useState<FeedPaneTab>('streams');
  const [selectedStreamId, setSelectedStreamId] = useState<string | undefined>(undefined);
  const [streamDrafts, setStreamDrafts] = useState<Record<string, StreamDraft>>({});
  const [apiKeyProvider, setApiKeyProvider] = useState<ScoringProvider>('openai');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const data = useFeedData({
    feedInput: queryState.input,
    pipelineId: queryState.draft.pipelineId,
    selectedStreamId,
    pane,
  });

  const mutations = useFeedMutations({
    onError: (message) => setActionError(message),
  });

  useEffect(() => {
    if (!selectedStreamId && data.streams[0]) {
      setSelectedStreamId(data.streams[0].id);
    }
  }, [selectedStreamId, data.streams]);

  useEffect(() => {
    setStreamDrafts((current) => {
      const next: Record<string, StreamDraft> = {};
      for (const stream of data.streams) {
        const existing = current[stream.id];
        next[stream.id] = {
          name: existing?.name ?? stream.name,
          query: existing?.query ?? stream.query,
          maxObjects: existing?.maxObjects ?? stream.maxObjects,
          isActive: existing?.isActive ?? stream.isActive,
        };
      }
      return next;
    });
  }, [data.streams]);

  const pipelineId = useMemo(
    () => queryState.draft.pipelineId || data.pipelines[0]?.id,
    [queryState.draft.pipelineId, data.pipelines]
  );

  function patchStreamDraft(streamId: string, patch: Partial<StreamDraft>) {
    setStreamDrafts((current) => ({
      ...current,
      [streamId]: {
        ...(current[streamId] || {
          name: '',
          query: 'search:technology transfer',
          maxObjects: 100,
          isActive: true,
        }),
        ...patch,
      },
    }));
  }

  function clearActionError(): void {
    if (actionError) {
      setActionError(null);
    }
  }

  return (
    <FeedView
      filters={queryState.draft}
      stageOptions={data.stageOptions}
      pipelines={data.pipelines}
      streams={data.streams}
      streamDrafts={streamDrafts}
      streamRuns={data.streamRuns}
      feed={data.feed}
      loading={data.loading}
      queryError={data.queryError}
      actionError={actionError}
      pending={mutations.pending}
      pane={pane}
      selectedStreamId={selectedStreamId}
      cursorHasPrevious={queryState.cursorHistory.length > 0}
      onPaneChange={(nextPane) => {
        setPane(nextPane);
        clearActionError();
      }}
      onFilterPatch={(patch) => {
        queryState.patchDraft(patch);
      }}
      onApplyFilters={() => {
        clearActionError();
        queryState.applyDraft();
      }}
      onPreviousPage={() => {
        clearActionError();
        queryState.moveCursorPrevious();
      }}
      onNextPage={(nextCursor) => {
        clearActionError();
        queryState.moveCursorNext(nextCursor);
      }}
      onAddToPipeline={(objectId) => {
        clearActionError();
        void mutations.addToPipeline({
          objectId,
          pipelineId,
          preferredStageId: queryState.draft.stageId || data.stageOptions[0]?.id,
        });
      }}
      onStreamSelect={(streamId) => {
        clearActionError();
        setSelectedStreamId(streamId);
      }}
      onStreamDraftPatch={patchStreamDraft}
      onStreamCreate={(input) => {
        clearActionError();
        void mutations.createStream({
          name: input.name.trim(),
          query: input.query.trim(),
          maxObjects: parseMaxObjects(input.maxObjects),
        });
      }}
      onStreamSave={(streamId) => {
        clearActionError();
        const draft = streamDrafts[streamId];
        if (!draft) {
          return;
        }
        void mutations.updateStream({
          id: streamId,
          name: draft.name.trim(),
          query: draft.query.trim(),
          maxObjects: parseMaxObjects(String(draft.maxObjects), draft.maxObjects),
          isActive: draft.isActive,
        });
      }}
      onStreamTrigger={(streamId) => {
        clearActionError();
        setSelectedStreamId(streamId);
        void mutations.triggerStream(streamId);
      }}
      apiKeyProviders={data.apiKeyProviders}
      apiKeyProvider={apiKeyProvider}
      apiKeyValue={apiKeyValue}
      onApiKeyProviderChange={setApiKeyProvider}
      onApiKeyValueChange={setApiKeyValue}
      onApiKeySave={() => {
        clearActionError();
        if (!apiKeyValue.trim()) {
          setActionError('API key cannot be empty.');
          return;
        }
        void mutations
          .upsertApiKey({ provider: apiKeyProvider, apiKey: apiKeyValue.trim() })
          .then(() => setApiKeyValue(''))
          .catch((cause) => {
            setActionError(asClientErrorMessage(cause, 'Failed to save API key.'));
          });
      }}
      onApiKeyRevoke={(provider) => {
        clearActionError();
        void mutations.revokeApiKey(provider);
      }}
    />
  );
}
