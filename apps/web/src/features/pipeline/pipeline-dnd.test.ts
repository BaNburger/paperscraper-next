import { describe, expect, it } from 'vitest';
import type { PipelineBoard } from '@paperscraper/shared/browser';
import {
  applyOptimisticMove,
  findCardLocation,
  resolveMoveTarget,
} from './pipeline-dnd';

const board: PipelineBoard = {
  pipeline: {
    id: 'pipe_1',
    name: 'Main',
    description: null,
    createdAt: '2026-02-26T00:00:00.000Z',
    updatedAt: '2026-02-26T00:00:00.000Z',
  },
  stages: [
    {
      id: 'stage_a',
      pipelineId: 'pipe_1',
      name: 'Inbox',
      position: 0,
      cards: [
        {
          id: 'card_1',
          pipelineId: 'pipe_1',
          stageId: 'stage_a',
          objectId: 'obj_1',
          position: 0,
          object: {
            id: 'obj_1',
            title: 'Object 1',
            publishedAt: null,
            topScore: null,
          },
        },
      ],
    },
    {
      id: 'stage_b',
      pipelineId: 'pipe_1',
      name: 'Review',
      position: 1,
      cards: [],
    },
  ],
};

describe('pipeline dnd helpers', () => {
  it('finds card location by id', () => {
    expect(findCardLocation(board, 'card_1')).toEqual({ stageId: 'stage_a', index: 0 });
    expect(findCardLocation(board, 'missing')).toBeNull();
  });

  it('resolves stage drop targets', () => {
    const source = { stageId: 'stage_a', index: 0 };
    expect(resolveMoveTarget(board, source, 'stage:stage_b')).toEqual({
      toStageId: 'stage_b',
      toPosition: 0,
    });
  });

  it('applies optimistic move with rebased positions', () => {
    const moved = applyOptimisticMove(board, 'card_1', {
      toStageId: 'stage_b',
      toPosition: 0,
    });

    expect(moved.stages[0]?.cards.length).toBe(0);
    expect(moved.stages[1]?.cards[0]?.id).toBe('card_1');
    expect(moved.stages[1]?.cards[0]?.position).toBe(0);
  });
});
