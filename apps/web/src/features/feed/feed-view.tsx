import type {
  ApiKeyProviderState,
  ObjectsFeedOutput,
  PipelineSummary,
  ScoringProvider,
  StreamDto,
  StreamRunDto,
} from '@paperscraper/shared/browser';
import { FeedMainPane } from './feed-main-pane';
import { FeedOperationsPane } from './feed-operations-pane';
import type { FeedFilters, FeedPaneTab, StageOption, StreamDraft } from './types';

interface FeedViewProps {
  filters: FeedFilters;
  stageOptions: StageOption[];
  pipelines: PipelineSummary[];
  streams: StreamDto[];
  streamDrafts: Record<string, StreamDraft>;
  streamRuns: StreamRunDto[];
  feed: ObjectsFeedOutput | undefined;
  loading: boolean;
  queryError: string | null;
  actionError: string | null;
  pending: boolean;
  pane: FeedPaneTab;
  selectedStreamId?: string;
  cursorHasPrevious: boolean;
  onPaneChange: (pane: FeedPaneTab) => void;
  onFilterPatch: (patch: Partial<FeedFilters>) => void;
  onApplyFilters: () => void;
  onPreviousPage: () => void;
  onNextPage: (nextCursor: string | null) => void;
  onAddToPipeline: (objectId: string) => void;
  onStreamSelect: (streamId: string) => void;
  onStreamDraftPatch: (streamId: string, patch: Partial<StreamDraft>) => void;
  onStreamCreate: (input: { name: string; query: string; maxObjects: string }) => void;
  onStreamSave: (streamId: string) => void;
  onStreamTrigger: (streamId: string) => void;
  apiKeyProviders: ApiKeyProviderState[];
  apiKeyProvider: ScoringProvider;
  apiKeyValue: string;
  onApiKeyProviderChange: (provider: ScoringProvider) => void;
  onApiKeyValueChange: (value: string) => void;
  onApiKeySave: () => void;
  onApiKeyRevoke: (provider: ScoringProvider) => void;
}

export function FeedView(props: FeedViewProps) {
  return (
    <section className="screen split-layout" data-testid="feed-screen">
      <FeedMainPane
        filters={props.filters}
        streams={props.streams}
        pipelines={props.pipelines}
        stageOptions={props.stageOptions}
        feed={props.feed}
        loading={props.loading}
        queryError={props.queryError}
        actionError={props.actionError}
        pending={props.pending}
        cursorHasPrevious={props.cursorHasPrevious}
        onFilterPatch={props.onFilterPatch}
        onApplyFilters={props.onApplyFilters}
        onPreviousPage={props.onPreviousPage}
        onNextPage={props.onNextPage}
        onAddToPipeline={props.onAddToPipeline}
      />

      <FeedOperationsPane
        pane={props.pane}
        streams={props.streams}
        selectedStreamId={props.selectedStreamId}
        streamDrafts={props.streamDrafts}
        streamRuns={props.streamRuns}
        apiKeyProviders={props.apiKeyProviders}
        apiKeyProvider={props.apiKeyProvider}
        apiKeyValue={props.apiKeyValue}
        onPaneChange={props.onPaneChange}
        onStreamSelect={props.onStreamSelect}
        onStreamDraftPatch={props.onStreamDraftPatch}
        onStreamCreate={props.onStreamCreate}
        onStreamSave={props.onStreamSave}
        onStreamTrigger={props.onStreamTrigger}
        onApiKeyProviderChange={props.onApiKeyProviderChange}
        onApiKeyValueChange={props.onApiKeyValueChange}
        onApiKeySave={props.onApiKeySave}
        onApiKeyRevoke={props.onApiKeyRevoke}
      />
    </section>
  );
}
