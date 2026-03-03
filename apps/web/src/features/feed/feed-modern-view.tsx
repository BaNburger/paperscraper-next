import type {
  ApiKeyProviderState,
  FeedColumn,
  FeedDensity,
  ObjectsFeedOutput,
  PipelineSummary,
  ScoringProvider,
  StreamDto,
  StreamRunDto,
  FeedSavedView,
} from '@paperscraper/shared/browser';
import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import { DensitySelect } from '../../components/ui/density-select';
import { Input } from '../../components/ui/input';
import { PaneWidthControl } from '../../components/ui/pane-width-control';
import { Select } from '../../components/ui/select';
import { EmptyState, ErrorState, LoadingState } from '../ui/route-state';
import { FeedOperationsModernPane } from './feed-operations-modern-pane';
import type { FeedFilters, FeedPaneTab, StageOption, StreamDraft } from './types';
const FEED_COLUMNS: FeedColumn[] = ['title', 'topScore', 'publishedAt', 'entities', 'stage'];
const COLUMN_LABELS: Record<FeedColumn, string> = {
  title: 'Title',
  topScore: 'Score',
  publishedAt: 'Published',
  entities: 'Entities',
  stage: 'Stage',
};
interface FeedModernViewProps {
  filters: FeedFilters;
  feed: ObjectsFeedOutput | undefined;
  loading: boolean;
  queryError: string | null;
  actionError: string | null;
  pending: boolean;
  streams: StreamDto[];
  pipelines: PipelineSummary[];
  stageOptions: StageOption[];
  streamDrafts: Record<string, StreamDraft>;
  streamRuns: StreamRunDto[];
  pane: FeedPaneTab;
  selectedStreamId?: string;
  cursorHasPrevious: boolean;
  visibleColumns: FeedColumn[];
  density: FeedDensity;
  sidePaneWidth: number;
  selectedObjectIds: string[];
  focusedIndex: number;
  savedViews: FeedSavedView[];
  selectedSavedViewId: string | null;
  saveViewName: string;
  batchPipelineId: string;
  batchStageId: string;
  apiKeyProviders: ApiKeyProviderState[];
  apiKeyProvider: ScoringProvider;
  apiKeyValue: string;
  batchUndoCardIds: string[];
  onFilterPatch: (patch: Partial<FeedFilters>) => void;
  onApplyFilters: () => void;
  onPreviousPage: () => void;
  onNextPage: (nextCursor: string | null) => void;
  onAddToPipeline: (objectId: string) => void;
  onToggleColumn: (column: FeedColumn) => void;
  onDensityChange: (density: FeedDensity) => void;
  onSidePaneWidthChange: (width: number) => void;
  onSelectObject: (objectId: string) => void;
  onFocusObject: (index: number) => void;
  onSelectAllVisible: () => void;
  onClearSelection: () => void;
  onSavedViewSelect: (id: string) => void;
  onSaveViewNameChange: (value: string) => void;
  onCreateSavedView: () => void;
  onUpdateSavedView: () => void;
  onDeleteSavedView: () => void;
  onBatchPipelineIdChange: (value: string) => void;
  onBatchStageIdChange: (value: string) => void;
  onBatchAssign: () => void;
  onBatchUndo: () => void;
  onShortcutsOpen: () => void;
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
export function FeedModernView(props: FeedModernViewProps) {
  const rowGapClass = props.density === 'compact' ? 'gap-2' : 'gap-3';
  const cardPadding = props.density === 'compact' ? 'p-3' : 'p-4';
  const selectedIds = useMemo(() => new Set(props.selectedObjectIds), [props.selectedObjectIds]);
  const hasRows = (props.feed?.items.length ?? 0) > 0;
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]" data-testid="feed-screen">
      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Feed</CardTitle>
                <CardDescription>Focus-first triage for objects and pipeline actions.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={props.onShortcutsOpen}>
                  Shortcuts
                </Button>
                <DensitySelect value={props.density} className="w-36" onChange={props.onDensityChange} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
              <Input
                placeholder="Search title/abstract"
                value={props.filters.query || ''}
                onChange={(event) => props.onFilterPatch({ query: event.target.value || undefined })}
              />
              <Select
                value={props.filters.sortBy}
                onChange={(event) =>
                  props.onFilterPatch({
                    sortBy: event.target.value === 'publishedAt' ? 'publishedAt' : 'topScore',
                  })
                }
              >
                <option value="topScore">Sort: Top Score</option>
                <option value="publishedAt">Sort: Publication Date</option>
              </Select>
              <Select
                value={props.filters.streamId || ''}
                onChange={(event) => props.onFilterPatch({ streamId: event.target.value || undefined })}
              >
                <option value="">All Streams</option>
                {props.streams.map((stream) => (
                  <option key={stream.id} value={stream.id}>
                    {stream.name}
                  </option>
                ))}
              </Select>
              <Select
                value={props.filters.pipelineId || ''}
                onChange={(event) => props.onFilterPatch({ pipelineId: event.target.value || undefined, stageId: undefined })}
              >
                <option value="">All Pipelines</option>
                {props.pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </Select>
              <Select
                value={props.filters.stageId || ''}
                onChange={(event) => props.onFilterPatch({ stageId: event.target.value || undefined })}
              >
                <option value="">All Stages</option>
                {props.stageOptions.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </Select>
              <Button onClick={props.onApplyFilters} disabled={props.pending}>
                Apply
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FEED_COLUMNS.map((column) => (
                <label key={column} className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={column === 'title' ? true : props.visibleColumns.includes(column)}
                    disabled={column === 'title'}
                    onChange={() => column !== 'title' && props.onToggleColumn(column)}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
              <div className="ml-auto">
                <PaneWidthControl value={props.sidePaneWidth} onChange={props.onSidePaneWidthChange} />
              </div>
            </div>
          </CardContent>
        </Card>
        {props.loading ? <LoadingState label="Loading feed..." /> : null}
        {props.queryError ? <ErrorState message={props.queryError} /> : null}
        {props.actionError ? <ErrorState message={props.actionError} /> : null}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={props.selectedSavedViewId || ''}
                onChange={(event) => props.onSavedViewSelect(event.target.value)}
                className="w-56"
              >
                <option value="">Saved views</option>
                {props.savedViews.map((savedView) => (
                  <option key={savedView.id} value={savedView.id}>
                    {savedView.name}
                  </option>
                ))}
              </Select>
              <Input
                value={props.saveViewName}
                placeholder="New saved view"
                onChange={(event) => props.onSaveViewNameChange(event.target.value)}
                className="w-56"
              />
              <Button size="sm" variant="secondary" onClick={props.onCreateSavedView}>
                Save New
              </Button>
              <Button size="sm" variant="outline" onClick={props.onUpdateSavedView}>
                Update
              </Button>
              <Button size="sm" variant="outline" onClick={props.onDeleteSavedView}>Delete</Button>
              <Badge variant="outline" className="ml-auto">
                Selected {props.selectedObjectIds.length}
              </Badge>
            </div>
          </CardHeader>
        </Card>
        {hasRows ? (
          <div className={`grid ${rowGapClass}`} data-testid="feed-list">
            {props.feed?.items.map((item, index) => (
              <article
                key={item.id}
                className={`object-card rounded-xl border bg-card ${cardPadding} ${
                  index === props.focusedIndex ? 'border-primary/60 shadow-md shadow-primary/5' : ''
                }`}
                onMouseEnter={() => props.onFocusObject(index)}
              >
                <div className="mb-2 flex items-center gap-2">
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onChange={() => props.onSelectObject(item.id)}
                  />
                  <h3 className="text-base font-semibold">
                    <Link to="/objects/$objectId" params={{ objectId: item.id }}>
                      {item.title}
                    </Link>
                  </h3>
                </div>
                <div className="grid gap-1 text-sm text-muted-foreground">
                  {props.visibleColumns.includes('topScore') ? <p>Top score: {item.topScore ?? 'n/a'}</p> : null}
                  {props.visibleColumns.includes('publishedAt') ? (
                    <p>Published: {item.publishedAt ?? 'n/a'}</p>
                  ) : null}
                  {props.visibleColumns.includes('entities') ? (
                    <p>
                      Entities:{' '}
                      {item.entities.length > 0 ? item.entities.map((entity) => entity.name).join(', ') : 'none'}
                    </p>
                  ) : null}
                  {props.visibleColumns.includes('stage') ? (
                    <p>Stage: {item.stage?.stageName ?? 'unassigned'}</p>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => props.onAddToPipeline(item.id)}>
                    Add to Pipeline
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : !props.loading && !props.queryError ? (
          <EmptyState label="No objects found for these filters." />
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={props.onSelectAllVisible}>
              Select Visible
            </Button>
            <Button size="sm" variant="ghost" onClick={props.onClearSelection}>
              Clear
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={!props.cursorHasPrevious || props.pending} onClick={props.onPreviousPage}>
              Previous
            </Button>
            <Button size="sm" variant="outline" disabled={!props.feed?.nextCursor || props.pending} onClick={() => props.onNextPage(props.feed?.nextCursor ?? null)}>
              Next
            </Button>
          </div>
        </div>
      </div>
      <aside className="sticky top-[4.75rem] grid gap-3 self-start" style={{ width: props.sidePaneWidth }}>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quick Assignment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Select
              id="feed-quick-assignment-pipeline"
              value={props.batchPipelineId}
              onChange={(event) => props.onBatchPipelineIdChange(event.target.value)}
            >
              <option value="">Select pipeline</option>
              {props.pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>
              ))}
            </Select>
            <Select value={props.batchStageId} onChange={(event) => props.onBatchStageIdChange(event.target.value)}>
              <option value="">Select stage</option>
              {props.stageOptions.map((stage) => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </Select>
            <Button onClick={props.onBatchAssign} disabled={props.selectedObjectIds.length === 0}>
              Add Selected ({props.selectedObjectIds.length})
            </Button>
            {props.batchUndoCardIds.length > 0 ? <Button variant="outline" onClick={props.onBatchUndo}>Undo Last Batch</Button> : null}
          </CardContent>
        </Card>
        <FeedOperationsModernPane
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
      </aside>
    </section>
  );
}
