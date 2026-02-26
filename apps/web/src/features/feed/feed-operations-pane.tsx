import type {
  ApiKeyProviderState,
  ScoringProvider,
  StreamDto,
  StreamRunDto,
} from '@paperscraper/shared/browser';
import { EmptyState } from '../ui/route-state';
import type { FeedPaneTab, StreamDraft } from './types';

interface FeedOperationsPaneProps {
  pane: FeedPaneTab;
  streams: StreamDto[];
  selectedStreamId?: string;
  streamDrafts: Record<string, StreamDraft>;
  streamRuns: StreamRunDto[];
  apiKeyProviders: ApiKeyProviderState[];
  apiKeyProvider: ScoringProvider;
  apiKeyValue: string;
  onPaneChange: (pane: FeedPaneTab) => void;
  onStreamSelect: (streamId: string) => void;
  onStreamDraftPatch: (streamId: string, patch: Partial<StreamDraft>) => void;
  onStreamCreate: (input: { name: string; query: string; maxObjects: string }) => void;
  onStreamSave: (streamId: string) => void;
  onStreamTrigger: (streamId: string) => void;
  onApiKeyProviderChange: (provider: ScoringProvider) => void;
  onApiKeyValueChange: (value: string) => void;
  onApiKeySave: () => void;
  onApiKeyRevoke: (provider: ScoringProvider) => void;
}

export function FeedOperationsPane(props: FeedOperationsPaneProps) {
  return (
    <aside className="split-side" data-testid="feed-side-pane">
      <div className="pane-tabs" role="tablist" aria-label="Feed operations">
        <button
          type="button"
          role="tab"
          data-testid="feed-tab-streams"
          aria-selected={props.pane === 'streams'}
          className={props.pane === 'streams' ? 'tab-active' : ''}
          onClick={() => props.onPaneChange('streams')}
        >
          Streams
        </button>
        <button
          type="button"
          role="tab"
          data-testid="feed-tab-api-keys"
          aria-selected={props.pane === 'apiKeys'}
          className={props.pane === 'apiKeys' ? 'tab-active' : ''}
          onClick={() => props.onPaneChange('apiKeys')}
        >
          API Keys
        </button>
      </div>

      <div className={props.pane === 'streams' ? 'pane-section pane-active' : 'pane-section'}>
        <StreamsPane
          streams={props.streams}
          selectedStreamId={props.selectedStreamId}
          drafts={props.streamDrafts}
          streamRuns={props.streamRuns}
          onSelect={props.onStreamSelect}
          onDraftPatch={props.onStreamDraftPatch}
          onCreate={props.onStreamCreate}
          onSave={props.onStreamSave}
          onTrigger={props.onStreamTrigger}
        />
      </div>
      <div className={props.pane === 'apiKeys' ? 'pane-section pane-active' : 'pane-section'}>
        <ApiKeysPane
          providers={props.apiKeyProviders}
          provider={props.apiKeyProvider}
          value={props.apiKeyValue}
          onProviderChange={props.onApiKeyProviderChange}
          onValueChange={props.onApiKeyValueChange}
          onSave={props.onApiKeySave}
          onRevoke={props.onApiKeyRevoke}
        />
      </div>
    </aside>
  );
}

interface StreamsPaneProps {
  streams: StreamDto[];
  selectedStreamId?: string;
  drafts: Record<string, StreamDraft>;
  streamRuns: StreamRunDto[];
  onSelect: (streamId: string) => void;
  onDraftPatch: (streamId: string, patch: Partial<StreamDraft>) => void;
  onCreate: (input: { name: string; query: string; maxObjects: string }) => void;
  onSave: (streamId: string) => void;
  onTrigger: (streamId: string) => void;
}

function StreamsPane(props: StreamsPaneProps) {
  return (
    <div className="panel-flyout" data-testid="feed-streams-pane">
      <h2>Streams</h2>
      <StreamCreateForm onCreate={props.onCreate} />
      {props.streams.map((stream) => {
        const draft = props.drafts[stream.id] || {
          name: stream.name,
          query: stream.query,
          maxObjects: stream.maxObjects,
          isActive: stream.isActive,
        };
        return (
          <div key={stream.id} className="stream-row">
            <button type="button" onClick={() => props.onSelect(stream.id)}>
              {props.selectedStreamId === stream.id ? 'Selected' : 'Select'}
            </button>
            <input
              value={draft.name}
              onChange={(event) => props.onDraftPatch(stream.id, { name: event.target.value })}
            />
            <input
              value={draft.query}
              onChange={(event) => props.onDraftPatch(stream.id, { query: event.target.value })}
            />
            <input
              value={String(draft.maxObjects)}
              onChange={(event) =>
                props.onDraftPatch(stream.id, {
                  maxObjects: Number(event.target.value || stream.maxObjects),
                })
              }
            />
            <label>
              Active
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  props.onDraftPatch(stream.id, { isActive: event.target.checked })
                }
              />
            </label>
            <button type="button" onClick={() => props.onSave(stream.id)}>
              Save
            </button>
            <button type="button" onClick={() => props.onTrigger(stream.id)}>
              Trigger
            </button>
          </div>
        );
      })}

      <div className="runs" data-testid="feed-stream-runs">
        {props.streamRuns.length === 0 ? <EmptyState label="No runs for selected stream." /> : null}
        {props.streamRuns.map((run) => (
          <div key={run.id} className="run-row">
            <span>{run.status}</span>
            <span>
              {run.insertedCount}/{run.updatedCount}/{run.failedCount}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StreamCreateForm({
  onCreate,
}: {
  onCreate: (input: { name: string; query: string; maxObjects: string }) => void;
}) {
  return (
    <form
      className="inline-grid"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onCreate({
          name: String(form.get('name') || ''),
          query: String(form.get('query') || ''),
          maxObjects: String(form.get('maxObjects') || '100'),
        });
        event.currentTarget.reset();
      }}
    >
      <input name="name" placeholder="Name" required />
      <input name="query" placeholder="search:technology transfer" required />
      <input name="maxObjects" placeholder="100" defaultValue="100" required />
      <button type="submit" data-testid="stream-create">
        Create
      </button>
    </form>
  );
}

function ApiKeysPane(props: {
  providers: ApiKeyProviderState[];
  provider: ScoringProvider;
  value: string;
  onProviderChange: (provider: ScoringProvider) => void;
  onValueChange: (value: string) => void;
  onSave: () => void;
  onRevoke: (provider: ScoringProvider) => void;
}) {
  return (
    <div className="panel-flyout" data-testid="feed-api-keys-pane">
      <h2>API Keys</h2>
      {props.providers.map((provider) => (
        <div key={provider.provider} className="run-row">
          <span>{provider.provider}</span>
          <span>{provider.status}</span>
          <button type="button" onClick={() => props.onRevoke(provider.provider)}>
            Revoke
          </button>
        </div>
      ))}

      <div className="inline-grid">
        <select
          value={props.provider}
          onChange={(event) =>
            props.onProviderChange(
              event.target.value === 'anthropic' ? 'anthropic' : 'openai'
            )
          }
        >
          <option value="openai">openai</option>
          <option value="anthropic">anthropic</option>
        </select>
        <input
          data-testid="api-key-input"
          type="password"
          placeholder="Provider key"
          value={props.value}
          onChange={(event) => props.onValueChange(event.target.value)}
        />
        <button type="button" data-testid="api-key-save" onClick={props.onSave}>
          Save
        </button>
      </div>
    </div>
  );
}
