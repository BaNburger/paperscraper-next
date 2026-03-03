import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeedColumn, FeedDensity, ScoringProvider } from '@paperscraper/shared/browser';
import { useNavigate } from '@tanstack/react-router';
import { isS2W1ActionsEnabled } from '../../lib/feature-flags';
import { FeedScreenRender } from './feed-screen-render';
import { useFeedData } from './use-feed-data';
import { useFeedMutations } from './use-feed-mutations';
import { useFeedQueryState } from './use-feed-query-state';
import { DEFAULT_VISIBLE_COLUMNS, type FeedPaneTab, type StreamDraft } from './types';

function asStreamDraft(stream: {
  name: string;
  query: string;
  maxObjects: number;
  isActive: boolean;
}): StreamDraft {
  return {
    name: stream.name,
    query: stream.query,
    maxObjectsInput: String(stream.maxObjects),
    isActive: stream.isActive,
  };
}

function mergeColumns(next: FeedColumn[]): FeedColumn[] {
  const unique = Array.from(new Set(next));
  return unique.length > 0 ? unique : ['title'];
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || ['input', 'textarea', 'select'].includes(tag);
}

export function FeedScreen() {
  const queryState = useFeedQueryState();
  const navigate = useNavigate();
  const actionsEnabled = isS2W1ActionsEnabled();
  const [pane, setPane] = useState<FeedPaneTab>('streams');
  const [selectedStreamId, setSelectedStreamId] = useState<string | undefined>(undefined);
  const [streamDrafts, setStreamDrafts] = useState<Record<string, StreamDraft>>({});
  const [apiKeyProvider, setApiKeyProvider] = useState<ScoringProvider>('openai');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [saveViewName, setSaveViewName] = useState('');
  const [selectedSavedViewId, setSelectedSavedViewId] = useState<string | null>(null);
  const [density, setDensity] = useState<FeedDensity>('comfortable');
  const [visibleColumns, setVisibleColumns] = useState<FeedColumn[]>(DEFAULT_VISIBLE_COLUMNS);
  const [sidePaneWidth, setSidePaneWidth] = useState(360);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);
  const [batchPipelineId, setBatchPipelineId] = useState('');
  const [batchStageId, setBatchStageId] = useState('');
  const [batchUndoCardIds, setBatchUndoCardIds] = useState<string[]>([]);
  const feedItemsRef = useRef<NonNullable<ReturnType<typeof useFeedData>['feed']>['items']>([]);
  const nextCursorRef = useRef<string | null>(null);
  const focusedIndexRef = useRef(0);
  const moveCursorPreviousRef = useRef(queryState.moveCursorPrevious);
  const moveCursorNextRef = useRef(queryState.moveCursorNext);

  const data = useFeedData({
    feedInput: queryState.input,
    pipelineId: batchPipelineId || queryState.draft.pipelineId,
    selectedStreamId,
    pane,
  });
  const mutations = useFeedMutations({
    onError: (message) => setActionError(message),
  });

  const pipelineId = useMemo(
    () => queryState.draft.pipelineId || data.pipelines[0]?.id,
    [queryState.draft.pipelineId, data.pipelines]
  );

  function runTask(task: Promise<unknown>): void {
    void task.catch(() => undefined);
  }

  function persistPreferences(patch: {
    density?: FeedDensity;
    columns?: FeedColumn[];
    sidePaneWidth?: number;
    lastSavedViewId?: string | null;
  }) {
    if (!data.preferences) {
      return;
    }
    runTask(
      mutations.upsertPreferences({
        defaultDensity: patch.density ?? density,
        defaultVisibleColumns: patch.columns ?? visibleColumns,
        feedSidePaneWidth: patch.sidePaneWidth ?? sidePaneWidth,
        pipelineSidePaneWidth: data.preferences.pipelineSidePaneWidth,
        lastSavedViewId:
          patch.lastSavedViewId !== undefined ? patch.lastSavedViewId : selectedSavedViewId,
      })
    );
  }

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
        next[stream.id] = existing ?? asStreamDraft(stream);
      }
      return next;
    });
  }, [data.streams]);

  useEffect(() => {
    if (preferencesHydrated || !data.preferences) {
      return;
    }
    setDensity(data.preferences.defaultDensity);
    setVisibleColumns(mergeColumns(data.preferences.defaultVisibleColumns));
    setSidePaneWidth(data.preferences.feedSidePaneWidth);
    setSelectedSavedViewId(data.preferences.lastSavedViewId);
    setPreferencesHydrated(true);
  }, [preferencesHydrated, data.preferences]);

  useEffect(() => {
    if (!batchPipelineId && data.pipelines[0]) {
      setBatchPipelineId(data.pipelines[0].id);
    }
  }, [batchPipelineId, data.pipelines]);

  useEffect(() => {
    if (!batchStageId && data.stageOptions[0]) {
      setBatchStageId(data.stageOptions[0].id);
    }
  }, [batchStageId, data.stageOptions]);

  useEffect(() => {
    setSelectedObjectIds((current) =>
      current.filter((id) => data.feed?.items.some((item) => item.id === id))
    );
    setFocusedIndex(0);
  }, [data.feed]);

  useEffect(() => {
    feedItemsRef.current = data.feed?.items ?? [];
    nextCursorRef.current = data.feed?.nextCursor ?? null;
  }, [data.feed]);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  useEffect(() => {
    moveCursorPreviousRef.current = queryState.moveCursorPrevious;
    moveCursorNextRef.current = queryState.moveCursorNext;
  }, [queryState.moveCursorNext, queryState.moveCursorPrevious]);

  useEffect(() => {
    if (!actionsEnabled) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || isTypingTarget(event.target)) {
        return;
      }

      const feedItems = feedItemsRef.current;
      const hasItems = feedItems.length > 0;
      if (event.key === '?') {
        event.preventDefault();
        setShortcutsOpen(true);
      } else if (event.key === 'j') {
        event.preventDefault();
        if (!hasItems) {
          return;
        }
        setFocusedIndex((current) => {
          const next = Math.min(feedItems.length - 1, current + 1);
          focusedIndexRef.current = next;
          return next;
        });
      } else if (event.key === 'k') {
        event.preventDefault();
        if (!hasItems) {
          return;
        }
        setFocusedIndex((current) => {
          const next = Math.max(0, current - 1);
          focusedIndexRef.current = next;
          return next;
        });
      } else if (event.key.toLowerCase() === 'x' && event.shiftKey) {
        event.preventDefault();
        setSelectedObjectIds(feedItems.map((item) => item.id));
      } else if (event.key.toLowerCase() === 'x') {
        event.preventDefault();
        const objectId = feedItems[focusedIndexRef.current]?.id;
        if (objectId) {
          setSelectedObjectIds((current) =>
            current.includes(objectId)
              ? current.filter((id) => id !== objectId)
              : [...current, objectId]
          );
        }
      } else if (event.key === 'Enter') {
        const objectId = feedItems[focusedIndexRef.current]?.id;
        if (objectId) {
          event.preventDefault();
          void navigate({ to: '/objects/$objectId', params: { objectId } });
        }
      } else if (event.key.toLowerCase() === 'a' && event.shiftKey) {
        event.preventDefault();
        const element = document.getElementById('feed-quick-assignment-pipeline');
        if (element instanceof HTMLElement) {
          element.focus();
        }
      } else if (event.key === '[') {
        event.preventDefault();
        moveCursorPreviousRef.current();
      } else if (event.key === ']') {
        event.preventDefault();
        moveCursorNextRef.current(nextCursorRef.current);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actionsEnabled, navigate]);

  return (
    <FeedScreenRender
      queryState={queryState}
      data={data}
      mutations={mutations}
      streamDrafts={streamDrafts}
      pane={pane}
      selectedStreamId={selectedStreamId}
      actionError={actionError}
      apiKeyProvider={apiKeyProvider}
      apiKeyValue={apiKeyValue}
      selectedObjectIds={selectedObjectIds}
      focusedIndex={focusedIndex}
      shortcutsOpen={shortcutsOpen}
      saveViewName={saveViewName}
      selectedSavedViewId={selectedSavedViewId}
      density={density}
      visibleColumns={visibleColumns}
      sidePaneWidth={sidePaneWidth}
      batchPipelineId={batchPipelineId}
      batchStageId={batchStageId}
      batchUndoCardIds={batchUndoCardIds}
      pipelineId={pipelineId}
      setPane={setPane}
      setSelectedStreamId={setSelectedStreamId}
      setStreamDrafts={setStreamDrafts}
      setActionError={setActionError}
      setApiKeyProvider={setApiKeyProvider}
      setApiKeyValue={setApiKeyValue}
      setSelectedObjectIds={setSelectedObjectIds}
      setFocusedIndex={setFocusedIndex}
      setShortcutsOpen={setShortcutsOpen}
      setSaveViewName={setSaveViewName}
      setSelectedSavedViewId={setSelectedSavedViewId}
      setDensity={setDensity}
      setVisibleColumns={setVisibleColumns}
      setSidePaneWidth={setSidePaneWidth}
      setBatchPipelineId={setBatchPipelineId}
      setBatchStageId={setBatchStageId}
      setBatchUndoCardIds={setBatchUndoCardIds}
      mergeColumns={mergeColumns}
      runTask={runTask}
      persistPreferences={persistPreferences}
    />
  );
}
