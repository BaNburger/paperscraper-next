import { useEffect, useState } from 'react';
import type { FeedDensity } from '@paperscraper/shared/browser';
import {
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation } from '@tanstack/react-query';
import { upsertWorkspaceFeedPreferences } from '../../lib/api/workspace';
import { PipelineView } from './pipeline-view';
import { findCardLocation, resolveMoveTarget } from './pipeline-dnd';
import { usePipelineBoardData } from './use-pipeline-board-data';
import { usePipelineBoardMutations } from './use-pipeline-board-mutations';
import { workspaceFeedPreferencesQueryOptions } from '../workspace/queries';
import { useQuery } from '@tanstack/react-query';

export function PipelineScreen() {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const [error, setError] = useState<string | null>(null);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [pipelineNameDraft, setPipelineNameDraft] = useState('');
  const [pipelineDescriptionDraft, setPipelineDescriptionDraft] = useState('');
  const [stageDrafts, setStageDrafts] = useState<Record<string, string>>({});
  const [newCardObjectId, setNewCardObjectId] = useState('');
  const [newCardStageId, setNewCardStageId] = useState('');
  const [density, setDensity] = useState<FeedDensity>('comfortable');
  const [sidePaneWidth, setSidePaneWidth] = useState(360);
  const [preferencesHydrated, setPreferencesHydrated] = useState(false);

  const data = usePipelineBoardData();
  const preferencesQuery = useQuery(workspaceFeedPreferencesQueryOptions());
  const preferencesMutation = useMutation({
    mutationFn: upsertWorkspaceFeedPreferences,
  });
  const mutations = usePipelineBoardMutations({
    onError: (message) => setError(message),
  });

  function runTask(task: Promise<unknown>): void {
    void task.catch(() => undefined);
  }

  function persistPreferences(patch: { density?: FeedDensity; sidePaneWidth?: number }) {
    if (!preferencesQuery.data) {
      return;
    }
    runTask(
      preferencesMutation.mutateAsync({
        ...preferencesQuery.data,
        defaultDensity: patch.density ?? density,
        pipelineSidePaneWidth: patch.sidePaneWidth ?? sidePaneWidth,
      })
    );
  }

  useEffect(() => {
    if (preferencesHydrated || !preferencesQuery.data) {
      return;
    }
    setDensity(preferencesQuery.data.defaultDensity);
    setSidePaneWidth(preferencesQuery.data.pipelineSidePaneWidth);
    setPreferencesHydrated(true);
  }, [preferencesHydrated, preferencesQuery.data]);

  useEffect(() => {
    if (!data.board) {
      return;
    }
    setPipelineNameDraft(data.board.pipeline.name);
    setPipelineDescriptionDraft(data.board.pipeline.description || '');
    setStageDrafts(Object.fromEntries(data.board.stages.map((stage) => [stage.id, stage.name])));
    const stageIds = new Set(data.board.stages.map((stage) => stage.id));
    if ((!newCardStageId || !stageIds.has(newCardStageId)) && data.board.stages[0]) {
      setNewCardStageId(data.board.stages[0].id);
    }
  }, [data.board, newCardStageId]);

  async function handleDragEnd(event: DragEndEvent): Promise<void> {
    if (!data.board || !event.active || !event.over) {
      return;
    }
    const cardId = String(event.active.id);
    const source = findCardLocation(data.board, cardId);
    if (!source) {
      return;
    }
    const target = resolveMoveTarget(data.board, source, String(event.over.id));
    if (!target) {
      return;
    }
    await mutations.moveCard({
      pipelineId: data.board.pipeline.id,
      cardId,
      toStageId: target.toStageId,
      toPosition: target.toPosition,
    });
  }

  return (
    <PipelineView
      board={data.board}
      pipelines={data.pipelines}
      selectedPipelineId={data.selectedPipelineId}
      loading={data.loading}
      error={error || data.error}
      pending={mutations.pending}
      sensors={sensors}
      pipelineNameDraft={pipelineNameDraft}
      pipelineDescriptionDraft={pipelineDescriptionDraft}
      stageDrafts={stageDrafts}
      newPipelineName={newPipelineName}
      newCardObjectId={newCardObjectId}
      newCardStageId={newCardStageId}
      density={density}
      sidePaneWidth={sidePaneWidth}
      onDensityChange={(nextDensity) => {
        setDensity(nextDensity);
        persistPreferences({ density: nextDensity });
      }}
      onSidePaneWidthChange={(width) => {
        setSidePaneWidth(width);
        persistPreferences({ sidePaneWidth: width });
      }}
      onSelectPipeline={(pipelineId) => {
        setError(null);
        data.setSelectedPipelineId(pipelineId);
      }}
      onPipelineNameDraftChange={setPipelineNameDraft}
      onPipelineDescriptionDraftChange={setPipelineDescriptionDraft}
      onStageDraftChange={(stageId, value) => setStageDrafts((current) => ({ ...current, [stageId]: value }))}
      onNewPipelineNameChange={setNewPipelineName}
      onNewCardObjectIdChange={setNewCardObjectId}
      onNewCardStageIdChange={setNewCardStageId}
      onCreatePipeline={() => {
        setError(null);
        if (!newPipelineName.trim()) {
          return;
        }
        runTask(
          mutations.createPipeline(newPipelineName.trim()).then(() => {
            setNewPipelineName('');
          })
        );
      }}
      onDeletePipeline={() => {
        setError(null);
        if (!data.board) {
          return;
        }
        runTask(
          mutations.deletePipeline(data.board.pipeline.id).then(() => {
            data.setSelectedPipelineId(undefined);
          })
        );
      }}
      onSavePipeline={() => {
        setError(null);
        if (!data.board) {
          return;
        }
        runTask(
          mutations.updatePipeline({
            id: data.board.pipeline.id,
            name: pipelineNameDraft,
            description: pipelineDescriptionDraft || null,
            stages: data.board.stages.map((stage) => ({
              id: stage.id,
              name: stageDrafts[stage.id] || stage.name,
            })),
          })
        );
      }}
      onAddCard={() => {
        setError(null);
        if (!data.board || !newCardObjectId.trim() || !newCardStageId) {
          return;
        }
        runTask(
          mutations
            .addCard({
              pipelineId: data.board.pipeline.id,
              stageId: newCardStageId,
              objectId: newCardObjectId.trim(),
            })
            .then(() => setNewCardObjectId(''))
        );
      }}
      onRemoveCard={(cardId) => {
        setError(null);
        if (!data.board) {
          return;
        }
        runTask(mutations.removeCard({ pipelineId: data.board.pipeline.id, cardId }));
      }}
      onDragEnd={(event) => {
        setError(null);
        runTask(handleDragEnd(event));
      }}
    />
  );
}
