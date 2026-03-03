import type { FeedDensity, PipelineBoard, PipelineSummary } from '@paperscraper/shared/browser';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { DensitySelect } from '../../components/ui/density-select';
import { Input } from '../../components/ui/input';
import { PaneWidthControl } from '../../components/ui/pane-width-control';
import { Select } from '../../components/ui/select';
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
  density: FeedDensity;
  sidePaneWidth: number;
  onDensityChange: (density: FeedDensity) => void;
  onSidePaneWidthChange: (width: number) => void;
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
  const cardPadding = props.density === 'compact' ? 'p-2.5' : 'p-3.5';

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]" data-testid="pipeline-screen">
      <div className="grid gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Pipeline Board</CardTitle>
              <div className="flex items-center gap-2">
                <DensitySelect value={props.density} onChange={props.onDensityChange} className="w-36" />
                <PaneWidthControl value={props.sidePaneWidth} onChange={props.onSidePaneWidthChange} />
              </div>
            </div>
          </CardHeader>
        </Card>

        {props.loading ? <LoadingState label="Loading board..." /> : null}
        {props.error ? <ErrorState message={props.error} /> : null}
        {!props.loading && !props.error && !props.board ? <EmptyState label="No pipeline available." /> : null}

        {props.board ? (
          <DndContext sensors={props.sensors} onDragEnd={props.onDragEnd}>
            <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-4" data-testid="pipeline-board">
              {props.board.stages.map((stage) => (
                <PipelineColumn
                  key={stage.id}
                  stage={stage}
                  cardPadding={cardPadding}
                  stageName={props.stageDrafts[stage.id] || stage.name}
                  onStageNameChange={(value) => props.onStageDraftChange(stage.id, value)}
                  onRemoveCard={props.onRemoveCard}
                />
              ))}
            </div>
          </DndContext>
        ) : null}
      </div>

      <aside className="sticky top-[4.75rem] grid gap-3 self-start" style={{ width: props.sidePaneWidth }} data-testid="pipeline-editor-pane">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Board Controls</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Select
              value={props.selectedPipelineId || ''}
              onChange={(event) => props.onSelectPipeline(event.target.value || undefined)}
            >
              {props.pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </Select>
            <Input
              placeholder="New pipeline"
              value={props.newPipelineName}
              onChange={(event) => props.onNewPipelineNameChange(event.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={props.onCreatePipeline} disabled={props.pending}>
                Create
              </Button>
              <Button variant="outline" onClick={props.onDeletePipeline} disabled={!props.board || props.pending}>
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>

        {props.board ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Pipeline Metadata</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Input value={props.pipelineNameDraft} onChange={(event) => props.onPipelineNameDraftChange(event.target.value)} />
                <Input value={props.pipelineDescriptionDraft} onChange={(event) => props.onPipelineDescriptionDraftChange(event.target.value)} placeholder="Description" />
                <Button onClick={props.onSavePipeline} disabled={props.pending}>
                  Save Pipeline
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Stages</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {props.board.stages.map((stage) => (
                  <div key={stage.id} className="grid grid-cols-[auto_1fr] items-center gap-2">
                    <span className="text-xs text-muted-foreground">{stage.position + 1}</span>
                    <Input
                      value={props.stageDrafts[stage.id] || stage.name}
                      onChange={(event) => props.onStageDraftChange(stage.id, event.target.value)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add Card</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Select
                  value={props.newCardStageId}
                  onChange={(event) => props.onNewCardStageIdChange(event.target.value)}
                >
                  {props.board.stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </Select>
                <Input
                  data-testid="pipeline-add-object-id"
                  value={props.newCardObjectId}
                  onChange={(event) => props.onNewCardObjectIdChange(event.target.value)}
                  placeholder="Object ID"
                />
                <Button data-testid="pipeline-add-card" onClick={props.onAddCard}>
                  Add Card
                </Button>
              </CardContent>
            </Card>
          </>
        ) : null}
      </aside>
    </section>
  );
}

function PipelineColumn({
  stage,
  stageName,
  cardPadding,
  onStageNameChange,
  onRemoveCard,
}: {
  stage: PipelineBoard['stages'][number];
  stageName: string;
  cardPadding: string;
  onStageNameChange: (value: string) => void;
  onRemoveCard: (cardId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `stage:${stage.id}` });

  return (
    <div ref={setNodeRef}>
      <Card>
      <CardHeader className="pb-2">
        <Input value={stageName} onChange={(event) => onStageNameChange(event.target.value)} />
      </CardHeader>
      <CardContent>
        <SortableContext items={stage.cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-2">
            {stage.cards.map((card) => (
              <SortableCard key={card.id} card={card} cardPadding={cardPadding} onRemoveCard={onRemoveCard} />
            ))}
          </div>
        </SortableContext>
      </CardContent>
      </Card>
    </div>
  );
}

function SortableCard({
  card,
  cardPadding,
  onRemoveCard,
}: {
  card: PipelineBoard['stages'][number]['cards'][number];
  cardPadding: string;
  onRemoveCard: (cardId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: card.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <article className={`rounded-lg border border-border bg-muted/40 ${cardPadding}`} ref={setNodeRef} style={style}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" className="rounded border border-border px-2 text-xs" {...attributes} {...listeners}>
          Drag
        </button>
        <Button size="sm" variant="ghost" onClick={() => onRemoveCard(card.id)}>
          Remove
        </Button>
      </div>
      <h4 className="text-sm font-semibold">{card.object.title}</h4>
      <p className="text-xs text-muted-foreground">Score: {card.object.topScore ?? 'n/a'}</p>
    </article>
  );
}
