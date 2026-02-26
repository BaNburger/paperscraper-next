import { useEffect, useState } from 'react';
import {
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { PipelineView } from './pipeline-view';
import { findCardLocation, resolveMoveTarget } from './pipeline-dnd';
import { usePipelineBoardData } from './use-pipeline-board-data';
import { usePipelineBoardMutations } from './use-pipeline-board-mutations';

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

  const data = usePipelineBoardData();
  const mutations = usePipelineBoardMutations({
    onError: (message) => setError(message),
  });

  useEffect(() => {
    if (!data.board) {
      return;
    }
    setPipelineNameDraft(data.board.pipeline.name);
    setPipelineDescriptionDraft(data.board.pipeline.description || '');
    setStageDrafts(
      Object.fromEntries(data.board.stages.map((stage) => [stage.id, stage.name]))
    );
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
      onSelectPipeline={(pipelineId) => {
        setError(null);
        data.setSelectedPipelineId(pipelineId);
      }}
      onPipelineNameDraftChange={setPipelineNameDraft}
      onPipelineDescriptionDraftChange={setPipelineDescriptionDraft}
      onStageDraftChange={(stageId, value) =>
        setStageDrafts((current) => ({ ...current, [stageId]: value }))
      }
      onNewPipelineNameChange={setNewPipelineName}
      onNewCardObjectIdChange={setNewCardObjectId}
      onNewCardStageIdChange={setNewCardStageId}
      onCreatePipeline={() => {
        setError(null);
        if (!newPipelineName.trim()) {
          return;
        }
        void mutations.createPipeline(newPipelineName.trim()).then(() => {
          setNewPipelineName('');
        });
      }}
      onDeletePipeline={() => {
        setError(null);
        if (!data.board) {
          return;
        }
        void mutations.deletePipeline(data.board.pipeline.id).then(() => {
          data.setSelectedPipelineId(undefined);
        });
      }}
      onSavePipeline={() => {
        setError(null);
        if (!data.board) {
          return;
        }
        void mutations.updatePipeline({
          id: data.board.pipeline.id,
          name: pipelineNameDraft,
          description: pipelineDescriptionDraft || null,
          stages: data.board.stages.map((stage) => ({
            id: stage.id,
            name: stageDrafts[stage.id] || stage.name,
          })),
        });
      }}
      onAddCard={() => {
        setError(null);
        if (!data.board || !newCardObjectId.trim() || !newCardStageId) {
          return;
        }
        void mutations
          .addCard({
            pipelineId: data.board.pipeline.id,
            stageId: newCardStageId,
            objectId: newCardObjectId.trim(),
          })
          .then(() => setNewCardObjectId(''));
      }}
      onRemoveCard={(cardId) => {
        setError(null);
        if (!data.board) {
          return;
        }
        void mutations.removeCard({ pipelineId: data.board.pipeline.id, cardId });
      }}
      onDragEnd={(event) => {
        setError(null);
        void handleDragEnd(event);
      }}
    />
  );
}
