import type { PipelineBoard } from '@paperscraper/shared/browser';

export interface CardLocation {
  stageId: string;
  index: number;
}

export interface MoveTarget {
  toStageId: string;
  toPosition: number;
}

export function findCardLocation(
  board: PipelineBoard,
  cardId: string
): CardLocation | null {
  for (const stage of board.stages) {
    const index = stage.cards.findIndex((card) => card.id === cardId);
    if (index >= 0) {
      return { stageId: stage.id, index };
    }
  }
  return null;
}

export function resolveMoveTarget(
  board: PipelineBoard,
  source: CardLocation,
  overId: string
): MoveTarget | null {
  if (overId.startsWith('stage:')) {
    const stageId = overId.replace('stage:', '');
    const stage = board.stages.find((entry) => entry.id === stageId);
    if (!stage) {
      return null;
    }
    return { toStageId: stageId, toPosition: stage.cards.length };
  }

  const overLocation = findCardLocation(board, overId);
  if (!overLocation) {
    return null;
  }

  return {
    toStageId: overLocation.stageId,
    toPosition: overLocation.index,
  };
}

export function applyOptimisticMove(
  board: PipelineBoard,
  cardId: string,
  target: MoveTarget
): PipelineBoard {
  const next: PipelineBoard = {
    ...board,
    stages: board.stages.map((stage) => ({
      ...stage,
      cards: [...stage.cards],
    })),
  };

  const source = findCardLocation(next, cardId);
  if (!source) {
    return next;
  }

  const sourceStage = next.stages.find((stage) => stage.id === source.stageId);
  const targetStage = next.stages.find((stage) => stage.id === target.toStageId);
  if (!sourceStage || !targetStage) {
    return next;
  }

  const [card] = sourceStage.cards.splice(source.index, 1);
  if (!card) {
    return next;
  }

  const boundedPosition = Math.max(0, Math.min(target.toPosition, targetStage.cards.length));
  targetStage.cards.splice(boundedPosition, 0, {
    ...card,
    stageId: target.toStageId,
  });

  for (const stage of next.stages) {
    stage.cards = stage.cards.map((stageCard, index) => ({
      ...stageCard,
      position: index,
    }));
  }

  return next;
}
