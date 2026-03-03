import type { FeedColumn, FeedDensity, ScoringProvider } from '@paperscraper/shared/browser';
import { asClientErrorMessage } from '../../lib/api/errors';
import { FeedModernView } from './feed-modern-view';
import { FeedShortcutsDialog } from './feed-shortcuts-dialog';
import type { useFeedData } from './use-feed-data';
import type { useFeedMutations } from './use-feed-mutations';
import type { useFeedQueryState } from './use-feed-query-state';
import type { FeedPaneTab, StreamDraft } from './types';

function parseMaxObjects(value: string, fallback = 100): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(500, Math.floor(parsed)));
}

interface FeedScreenRenderProps {
  queryState: ReturnType<typeof useFeedQueryState>;
  data: ReturnType<typeof useFeedData>;
  mutations: ReturnType<typeof useFeedMutations>;
  streamDrafts: Record<string, StreamDraft>;
  pane: FeedPaneTab;
  selectedStreamId?: string;
  actionError: string | null;
  apiKeyProvider: ScoringProvider;
  apiKeyValue: string;
  selectedObjectIds: string[];
  focusedIndex: number;
  shortcutsOpen: boolean;
  saveViewName: string;
  selectedSavedViewId: string | null;
  density: FeedDensity;
  visibleColumns: FeedColumn[];
  sidePaneWidth: number;
  batchPipelineId: string;
  batchStageId: string;
  batchUndoCardIds: string[];
  pipelineId?: string;
  setPane: (pane: FeedPaneTab) => void;
  setSelectedStreamId: (streamId: string | undefined) => void;
  setStreamDrafts: (
    value: Record<string, StreamDraft> | ((value: Record<string, StreamDraft>) => Record<string, StreamDraft>)
  ) => void;
  setActionError: (value: string | null) => void;
  setApiKeyProvider: (provider: ScoringProvider) => void;
  setApiKeyValue: (value: string) => void;
  setSelectedObjectIds: (ids: string[] | ((ids: string[]) => string[])) => void;
  setFocusedIndex: (index: number) => void;
  setShortcutsOpen: (open: boolean) => void;
  setSaveViewName: (value: string) => void;
  setSelectedSavedViewId: (id: string | null) => void;
  setDensity: (density: FeedDensity) => void;
  setVisibleColumns: (columns: FeedColumn[]) => void;
  setSidePaneWidth: (width: number) => void;
  setBatchPipelineId: (id: string) => void;
  setBatchStageId: (id: string) => void;
  setBatchUndoCardIds: (ids: string[]) => void;
  mergeColumns: (next: FeedColumn[]) => FeedColumn[];
  runTask: (task: Promise<unknown>) => void;
  persistPreferences: (patch: {
    density?: FeedDensity;
    columns?: FeedColumn[];
    sidePaneWidth?: number;
    lastSavedViewId?: string | null;
  }) => void;
}

export function FeedScreenRender(props: FeedScreenRenderProps) {
  return (
    <>
      <FeedModernView
        filters={props.queryState.draft}
        stageOptions={props.data.stageOptions}
        pipelines={props.data.pipelines}
        streams={props.data.streams}
        streamDrafts={props.streamDrafts}
        streamRuns={props.data.streamRuns}
        feed={props.data.feed}
        loading={props.data.loading}
        queryError={props.data.queryError}
        actionError={props.actionError}
        pending={props.mutations.pending}
        pane={props.pane}
        selectedStreamId={props.selectedStreamId}
        cursorHasPrevious={props.queryState.cursorHistory.length > 0}
        apiKeyProviders={props.data.apiKeyProviders}
        apiKeyProvider={props.apiKeyProvider}
        apiKeyValue={props.apiKeyValue}
        visibleColumns={props.visibleColumns}
        density={props.density}
        sidePaneWidth={props.sidePaneWidth}
        selectedObjectIds={props.selectedObjectIds}
        focusedIndex={props.focusedIndex}
        savedViews={props.data.savedViews}
        selectedSavedViewId={props.selectedSavedViewId}
        saveViewName={props.saveViewName}
        batchPipelineId={props.batchPipelineId}
        batchStageId={props.batchStageId}
        batchUndoCardIds={props.batchUndoCardIds}
        onPaneChange={props.setPane}
        onFilterPatch={props.queryState.patchDraft}
        onApplyFilters={props.queryState.applyDraft}
        onPreviousPage={props.queryState.moveCursorPrevious}
        onNextPage={props.queryState.moveCursorNext}
        onAddToPipeline={(objectId) =>
          props.runTask(
            props.mutations.addToPipeline({
              objectId,
              pipelineId: props.pipelineId,
              preferredStageId:
                props.queryState.draft.stageId || props.data.stageOptions[0]?.id,
            })
          )
        }
        onToggleColumn={(column) => {
          const next = props.visibleColumns.includes(column)
            ? props.visibleColumns.filter((value) => value !== column)
            : [...props.visibleColumns, column];
          const merged = props.mergeColumns(next);
          props.setVisibleColumns(merged);
          props.persistPreferences({ columns: merged });
        }}
        onDensityChange={(nextDensity) => {
          props.setDensity(nextDensity);
          props.persistPreferences({ density: nextDensity });
        }}
        onSidePaneWidthChange={(width) => {
          props.setSidePaneWidth(width);
          props.persistPreferences({ sidePaneWidth: width });
        }}
        onSelectObject={(objectId) =>
          props.setSelectedObjectIds((current) =>
            current.includes(objectId)
              ? current.filter((id) => id !== objectId)
              : [...current, objectId]
          )
        }
        onFocusObject={props.setFocusedIndex}
        onSelectAllVisible={() =>
          props.setSelectedObjectIds((props.data.feed?.items ?? []).map((item) => item.id))
        }
        onClearSelection={() => props.setSelectedObjectIds([])}
        onSavedViewSelect={(savedViewId) => {
          const savedView = props.data.savedViews.find((value) => value.id === savedViewId);
          if (!savedView) {
            props.setSelectedSavedViewId(null);
            props.persistPreferences({ lastSavedViewId: null });
            return;
          }
          props.setSelectedSavedViewId(savedView.id);
          props.queryState.applyFilters(savedView.definition.filters);
          props.setDensity(savedView.definition.layout.density);
          const columns = props.mergeColumns(savedView.definition.layout.visibleColumns);
          props.setVisibleColumns(columns);
          props.setSidePaneWidth(savedView.definition.layout.sidePaneWidth);
          props.persistPreferences({
            density: savedView.definition.layout.density,
            columns,
            sidePaneWidth: savedView.definition.layout.sidePaneWidth,
            lastSavedViewId: savedView.id,
          });
        }}
        onSaveViewNameChange={props.setSaveViewName}
        onCreateSavedView={() => {
          if (!props.saveViewName.trim()) {
            props.setActionError('Saved view name cannot be empty.');
            return;
          }
          props.runTask(
            props.mutations
              .createSavedView({
                name: props.saveViewName.trim(),
                definition: {
                  filters: props.queryState.draft,
                  layout: {
                    density: props.density,
                    visibleColumns: props.visibleColumns,
                    sidePaneWidth: props.sidePaneWidth,
                  },
                },
              })
              .then((savedView) => {
                props.setSelectedSavedViewId(savedView.id);
                props.setSaveViewName('');
                props.persistPreferences({ lastSavedViewId: savedView.id });
              })
          );
        }}
        onUpdateSavedView={() => {
          if (!props.selectedSavedViewId) {
            return;
          }
          props.runTask(
            props.mutations.updateSavedView({
              id: props.selectedSavedViewId,
              definition: {
                filters: props.queryState.draft,
                layout: {
                  density: props.density,
                  visibleColumns: props.visibleColumns,
                  sidePaneWidth: props.sidePaneWidth,
                },
              },
            })
          );
        }}
        onDeleteSavedView={() => {
          if (!props.selectedSavedViewId) {
            return;
          }
          props.runTask(
            props.mutations.deleteSavedView(props.selectedSavedViewId).then(() => {
              props.setSelectedSavedViewId(null);
              props.persistPreferences({ lastSavedViewId: null });
            })
          );
        }}
        onBatchPipelineIdChange={props.setBatchPipelineId}
        onBatchStageIdChange={props.setBatchStageId}
        onBatchAssign={() => {
          if (props.selectedObjectIds.length === 0) {
            return;
          }
          props.runTask(
            props.mutations
              .addBatchToPipeline({
                objectIds: props.selectedObjectIds,
                pipelineId: props.batchPipelineId,
                preferredStageId: props.batchStageId || undefined,
              })
              .then((result) => {
                props.setBatchUndoCardIds(result.addedCardIds);
                props.setSelectedObjectIds([]);
              })
          );
        }}
        onBatchUndo={() => {
          if (props.batchUndoCardIds.length === 0 || !props.batchPipelineId) {
            return;
          }
          props.runTask(
            props.mutations
              .removeBatchCards({
                pipelineId: props.batchPipelineId,
                cardIds: props.batchUndoCardIds,
              })
              .then(() => props.setBatchUndoCardIds([]))
          );
        }}
        onShortcutsOpen={() => props.setShortcutsOpen(true)}
        onStreamSelect={props.setSelectedStreamId}
        onStreamDraftPatch={(streamId, patch) =>
          props.setStreamDrafts((current) => ({
            ...current,
            [streamId]: {
              ...(current[streamId] || {
                name: '',
                query: 'search:technology transfer',
                maxObjectsInput: '100',
                isActive: true,
              }),
              ...patch,
            },
          }))
        }
        onStreamCreate={(input) =>
          props.runTask(
            props.mutations
              .createStream({
                name: input.name.trim(),
                query: input.query.trim(),
                maxObjects: parseMaxObjects(input.maxObjects),
              })
              .then((stream) => {
                props.setSelectedStreamId(stream.id);
                props.queryState.patchDraft({ streamId: stream.id });
              })
          )
        }
        onStreamSave={(streamId) => {
          const draft = props.streamDrafts[streamId];
          if (!draft) {
            return;
          }
          props.runTask(
            props.mutations.updateStream({
              id: streamId,
              name: draft.name.trim(),
              query: draft.query.trim(),
              maxObjects: parseMaxObjects(draft.maxObjectsInput),
              isActive: draft.isActive,
            })
          );
        }}
        onStreamTrigger={(streamId) => props.runTask(props.mutations.triggerStream(streamId))}
        onApiKeyProviderChange={props.setApiKeyProvider}
        onApiKeyValueChange={props.setApiKeyValue}
        onApiKeySave={() => {
          if (!props.apiKeyValue.trim()) {
            props.setActionError('API key cannot be empty.');
            return;
          }
          void props.mutations
            .upsertApiKey({
              provider: props.apiKeyProvider,
              apiKey: props.apiKeyValue.trim(),
            })
            .then(() => props.setApiKeyValue(''))
            .catch((cause) => {
              props.setActionError(asClientErrorMessage(cause, 'Failed to save API key.'));
            });
        }}
        onApiKeyRevoke={(provider) => props.runTask(props.mutations.revokeApiKey(provider))}
      />
      <FeedShortcutsDialog open={props.shortcutsOpen} onClose={() => props.setShortcutsOpen(false)} />
    </>
  );
}
