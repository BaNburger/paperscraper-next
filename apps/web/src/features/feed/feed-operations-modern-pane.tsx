import { useMemo, useState } from 'react';
import type {
  ApiKeyProviderState,
  ScoringProvider,
  StreamDto,
  StreamRunDto,
} from '@paperscraper/shared/browser';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import type { FeedPaneTab, StreamDraft } from './types';

interface FeedOperationsModernPaneProps {
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

export function FeedOperationsModernPane(props: FeedOperationsModernPaneProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={props.pane === 'streams' ? 'secondary' : 'ghost'}
            onClick={() => props.onPaneChange('streams')}
          >
            Streams
          </Button>
          <Button
            size="sm"
            variant={props.pane === 'apiKeys' ? 'secondary' : 'ghost'}
            onClick={() => props.onPaneChange('apiKeys')}
          >
            API Keys
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {props.pane === 'streams' ? (
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
        ) : (
          <ApiKeysPane
            providers={props.apiKeyProviders}
            provider={props.apiKeyProvider}
            value={props.apiKeyValue}
            onProviderChange={props.onApiKeyProviderChange}
            onValueChange={props.onApiKeyValueChange}
            onSave={props.onApiKeySave}
            onRevoke={props.onApiKeyRevoke}
          />
        )}
      </CardContent>
    </Card>
  );
}

function StreamsPane({
  streams,
  selectedStreamId,
  drafts,
  streamRuns,
  onSelect,
  onDraftPatch,
  onCreate,
  onSave,
  onTrigger,
}: {
  streams: StreamDto[];
  selectedStreamId?: string;
  drafts: Record<string, StreamDraft>;
  streamRuns: StreamRunDto[];
  onSelect: (streamId: string) => void;
  onDraftPatch: (streamId: string, patch: Partial<StreamDraft>) => void;
  onCreate: (input: { name: string; query: string; maxObjects: string }) => void;
  onSave: (streamId: string) => void;
  onTrigger: (streamId: string) => void;
}) {
  const [streamFilter, setStreamFilter] = useState('');
  const normalizedFilter = streamFilter.trim().toLowerCase();
  const activeId = selectedStreamId || streams[0]?.id;
  const selectedStream = useMemo(() => streams.find((stream) => stream.id === activeId), [activeId, streams]);
  const visibleStreams = useMemo(() => {
    if (!normalizedFilter) {
      return streams;
    }
    return streams.filter((stream) => {
      const haystack = `${stream.name} ${stream.query}`.toLowerCase();
      return haystack.includes(normalizedFilter);
    });
  }, [streams, normalizedFilter]);
  const draft =
    selectedStream &&
    (drafts[selectedStream.id] || {
      name: selectedStream.name,
      query: selectedStream.query,
      maxObjectsInput: String(selectedStream.maxObjects),
      isActive: selectedStream.isActive,
    });

  return (
    <div className="grid gap-2">
      <CardTitle className="text-sm">Streams</CardTitle>
      <StreamCreateForm onCreate={onCreate} />
      <Input value={streamFilter} onChange={(event) => setStreamFilter(event.target.value)} placeholder="Filter streams" />
      <div className="max-h-56 space-y-1 overflow-auto pr-1">
        {visibleStreams.map((stream) => (
          <button
            key={stream.id}
            type="button"
            className={`w-full rounded-md border p-2 text-left text-xs ${
              stream.id === activeId ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => onSelect(stream.id)}
          >
            <div className="font-medium">{stream.name}</div>
            <div className="text-muted-foreground">{stream.isActive ? 'active' : 'inactive'}</div>
          </button>
        ))}
      </div>
      {selectedStream && draft ? (
        <div className="grid gap-2 rounded-md border border-border p-2">
          <Input value={draft.name} onChange={(event) => onDraftPatch(selectedStream.id, { name: event.target.value })} />
          <Input value={draft.query} onChange={(event) => onDraftPatch(selectedStream.id, { query: event.target.value })} />
          <Input value={draft.maxObjectsInput} onChange={(event) => onDraftPatch(selectedStream.id, { maxObjectsInput: event.target.value })} />
          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={draft.isActive} onChange={(event) => onDraftPatch(selectedStream.id, { isActive: event.target.checked })} />
            Active
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onSave(selectedStream.id)}>
              Save
            </Button>
            <Button size="sm" onClick={() => onTrigger(selectedStream.id)}>
              Trigger
            </Button>
          </div>
        </div>
      ) : null}
      <div className="grid gap-1">
        {streamRuns.slice(0, 8).map((run) => (
          <div key={run.id} className="rounded-md border border-border p-2 text-xs">
            <div className="font-medium">{run.status}</div>
            <div className="text-muted-foreground">
              {run.insertedCount}/{run.updatedCount}/{run.failedCount}
            </div>
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
      className="grid gap-2"
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
      <Input name="name" placeholder="Stream name" required />
      <Input name="query" placeholder="search:technology transfer" required />
      <Input name="maxObjects" placeholder="100" defaultValue="100" required />
      <Button size="sm" type="submit" variant="outline">
        Create Stream
      </Button>
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
    <div className="grid gap-2">
      <CardTitle className="text-sm">API Keys</CardTitle>
      {props.providers.map((provider) => (
        <div key={provider.provider} className="flex items-center justify-between rounded-md border border-border p-2 text-xs">
          <span>{provider.provider}</span>
          <span className="text-muted-foreground">{provider.status}</span>
          <Button size="sm" variant="ghost" onClick={() => props.onRevoke(provider.provider)}>
            Revoke
          </Button>
        </div>
      ))}
      <Select
        value={props.provider}
        onChange={(event) => props.onProviderChange(event.target.value === 'anthropic' ? 'anthropic' : 'openai')}
      >
        <option value="openai">openai</option>
        <option value="anthropic">anthropic</option>
      </Select>
      <Input
        type="password"
        placeholder="Provider key"
        value={props.value}
        onChange={(event) => props.onValueChange(event.target.value)}
      />
      <Button onClick={props.onSave}>Save Key</Button>
    </div>
  );
}
