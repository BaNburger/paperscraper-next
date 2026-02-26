import type { PipelineBoard, PipelineSummary } from '@paperscraper/shared/browser';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { EmptyState, ErrorState, LoadingState } from '../ui/route-state';

interface PipelineViewProps {
  board: PipelineBoard | undefined;
  pipelines: PipelineSummary[];
  selectedPipelineId?: string;
  loading: boolean;
  error: string | null;
  pending: boolean;
  sensors: Parameters<typeof DndContext>[0]['sensors'];
  pipelineNameDraft: string;
  pipelineDescriptionDraft: string;
  stageDrafts: Record<string, string>;
  newPipelineName: string;
  newCardObjectId: string;
  newCardStageId: string;
  onSelectPipeline: (pipelineId: string | undefined) => void;
  onPipelineNameDraftChange: (value: string) => void;
  onPipelineDescriptionDraftChange: (value: string) => void;
  onStageDraftChange: (stageId: string, value: string) => void;
  onNewPipelineNameChange: (value: string) => void;
  onNewCardObjectIdChange: (value: string) => void;
  onNewCardStageIdChange: (value: string) => void;
  onCreatePipeline: () => void;
  onDeletePipeline: () => void;
  onSavePipeline: () => void;
  onAddCard: () => void;
  onRemoveCard: (cardId: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

export function PipelineView(props: PipelineViewProps) {
  return (
    <section className="screen split-layout" data-testid="pipeline-screen">
      <div className="split-main">
        <header className="screen-header">
          <h1>Pipeline Board</h1>
        </header>

        {props.loading ? <LoadingState label="Loading board..." /> : null}
        {props.error ? <ErrorState message={props.error} /> : null}
        {!props.loading && !props.error && !props.board ? (
          <EmptyState label="No pipeline available." />
        ) : null}

        {props.board ? (
          <DndContext sensors={props.sensors} onDragEnd={props.onDragEnd}>
            <div className="board-grid" data-testid="pipeline-board">
              {props.board.stages.map((stage) => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  stageName={props.stageDrafts[stage.id] || stage.name}
                  onStageNameChange={(value) => props.onStageDraftChange(stage.id, value)}
                  onRemoveCard={props.onRemoveCard}
                />
              ))}
            </div>
          </DndContext>
        ) : null}
      </div>

      <aside className="split-side panel-flyout" data-testid="pipeline-editor-pane">
        <h2>Board Controls</h2>

        <div className="inline-grid">
          <select
            value={props.selectedPipelineId || ''}
            onChange={(event) => props.onSelectPipeline(event.target.value || undefined)}
          >
            {props.pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
          <input
            placeholder="New pipeline"
            value={props.newPipelineName}
            onChange={(event) => props.onNewPipelineNameChange(event.target.value)}
          />
          <button type="button" onClick={props.onCreatePipeline} disabled={props.pending}>
            Create
          </button>
          <button type="button" onClick={props.onDeletePipeline} disabled={!props.board || props.pending}>
            Delete
          </button>
        </div>

        {props.board ? (
          <>
            <div className="toolbar">
              <input
                value={props.pipelineNameDraft}
                onChange={(event) => props.onPipelineNameDraftChange(event.target.value)}
              />
              <input
                value={props.pipelineDescriptionDraft}
                onChange={(event) =>
                  props.onPipelineDescriptionDraftChange(event.target.value)
                }
                placeholder="Description"
              />
              <button type="button" onClick={props.onSavePipeline} disabled={props.pending}>
                Save Pipeline
              </button>
            </div>

            <div className="runs">
              {props.board.stages.map((stage) => (
                <div key={stage.id} className="stream-row">
                  <span>{stage.position + 1}</span>
                  <input
                    value={props.stageDrafts[stage.id] || stage.name}
                    onChange={(event) =>
                      props.onStageDraftChange(stage.id, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>

            <div className="inline-grid">
              <select
                value={props.newCardStageId}
                onChange={(event) => props.onNewCardStageIdChange(event.target.value)}
              >
                {props.board.stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
              <input
                data-testid="pipeline-add-object-id"
                value={props.newCardObjectId}
                onChange={(event) => props.onNewCardObjectIdChange(event.target.value)}
                placeholder="Object ID"
              />
              <button type="button" data-testid="pipeline-add-card" onClick={props.onAddCard}>
                Add Card
              </button>
            </div>
          </>
        ) : null}
      </aside>
    </section>
  );
}

function PipelineColumn({
  stage,
  stageName,
  onStageNameChange,
  onRemoveCard,
}: {
  stage: PipelineBoard['stages'][number];
  stageName: string;
  onStageNameChange: (value: string) => void;
  onRemoveCard: (cardId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `stage:${stage.id}` });

  return (
    <section className="board-column" ref={setNodeRef}>
      <input value={stageName} onChange={(event) => onStageNameChange(event.target.value)} />
      <SortableContext items={stage.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <div className="column-cards">
          {stage.cards.map((card) => (
            <SortableCard key={card.id} card={card} onRemoveCard={onRemoveCard} />
          ))}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({
  card,
  onRemoveCard,
}: {
  card: PipelineBoard['stages'][number]['cards'][number];
  onRemoveCard: (cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: card.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <article className="board-card" ref={setNodeRef} style={style}>
      <button type="button" className="drag-handle" {...attributes} {...listeners}>
        ::
      </button>
      <div>
        <h4>{card.object.title}</h4>
        <p className="muted">Score: {card.object.topScore ?? 'n/a'}</p>
      </div>
      <button type="button" onClick={() => onRemoveCard(card.id)}>
        Remove
      </button>
    </article>
  );
}
