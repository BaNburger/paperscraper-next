import { describe, expect, it } from 'vitest';
import {
  objectsFeedInputSchema,
  objectDetailOutputSchema,
  entityDetailOutputSchema,
  pipelineBoardSchema,
  pipelineCreateInputSchema,
  pipelineMoveCardInputSchema,
} from './contracts-s1_4';

describe('s1.4 contracts', () => {
  it('validates feed inputs and defaults', () => {
    const parsed = objectsFeedInputSchema.parse({
      sortBy: 'topScore',
      query: 'paper',
    });
    expect(parsed.limit).toBe(20);
  });

  it('validates object and entity detail payloads', () => {
    const object = objectDetailOutputSchema.parse({
      id: 'obj_1',
      externalId: 'https://openalex.org/W1',
      source: 'openalex',
      title: 'Title',
      abstract: null,
      publishedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      scores: [],
      entities: [],
      pipelineCards: [],
    });
    expect(object.id).toBe('obj_1');

    const entity = entityDetailOutputSchema.parse({
      id: 'ent_1',
      name: 'Ada',
      kind: 'author',
      externalId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      scores: [],
      relatedObjects: [],
    });
    expect(entity.id).toBe('ent_1');
  });

  it('validates pipeline contracts', () => {
    const input = pipelineCreateInputSchema.parse({
      name: 'Pipeline',
      stageNames: ['Inbox', 'Review', 'Decision'],
    });
    expect(input.stageNames).toHaveLength(3);

    const board = pipelineBoardSchema.parse({
      pipeline: {
        id: 'pipe_1',
        name: 'Pipeline',
        description: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [
        {
          id: 'stage_1',
          pipelineId: 'pipe_1',
          name: 'Inbox',
          position: 0,
          cards: [],
        },
      ],
    });
    expect(board.stages[0]!.name).toBe('Inbox');

    const moveInput = pipelineMoveCardInputSchema.parse({
      pipelineId: 'pipe_1',
      cardId: 'card_1',
      toStageId: 'stage_2',
      toPosition: 0,
    });
    expect(moveInput.toStageId).toBe('stage_2');
  });
});
