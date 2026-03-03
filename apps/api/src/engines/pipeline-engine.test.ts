import { describe, expect, it } from 'vitest';
import { createPipelineEngine } from './pipeline-engine';

function createEngine() {
  return createPipelineEngine({
    listPipelines: async () => [
      {
        id: 'pipe_1',
        name: 'Pipeline',
        description: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    createPipeline: async () => ({
      id: 'pipe_1',
      name: 'Pipeline',
      description: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }),
    updatePipeline: async (input) =>
      input.id === 'pipe_1'
        ? {
            id: 'pipe_1',
            name: 'Renamed',
            description: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          }
        : null,
    deletePipeline: async (id) => (id === 'pipe_1' ? { id, status: 'deleted' as const } : null),
    getBoard: async () => ({
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
    }),
    addCard: async () => ({
      pipeline: {
        id: 'pipe_1',
        name: 'Pipeline',
        description: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [],
    }),
    moveCard: async () => ({
      pipeline: {
        id: 'pipe_1',
        name: 'Pipeline',
        description: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [],
    }),
    removeCard: async () => ({
      pipeline: {
        id: 'pipe_1',
        name: 'Pipeline',
        description: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      stages: [],
    }),
    addCardsBatch: async () => ({
      pipelineId: 'pipe_1',
      stageId: 'stage_1',
      added: 1,
      skippedAlreadyPresent: 0,
      addedCardIds: ['card_1'],
    }),
    removeCardsBatch: async () => ({
      pipelineId: 'pipe_1',
      removed: 1,
      missing: 0,
    }),
  });
}

describe('pipeline engine', () => {
  it('lists pipelines and validates payload', async () => {
    const engine = createEngine();
    const list = await engine.list({});
    expect(list).toHaveLength(1);
  });

  it('supports create/update/delete flow with not-found checks', async () => {
    const engine = createEngine();
    const created = await engine.create({ name: 'Pipeline' });
    expect(created.id).toBe('pipe_1');
    const updated = await engine.update({ id: 'pipe_1', name: 'Renamed' });
    expect(updated.name).toBe('Renamed');
    await expect(engine.update({ id: 'missing', name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const deleted = await engine.delete({ id: 'pipe_1' });
    expect(deleted.status).toBe('deleted');
  });

  it('returns board payload for board and card mutations', async () => {
    const engine = createEngine();
    const board = await engine.getBoard({});
    expect(board.pipeline.id).toBe('pipe_1');
    await expect(
      engine.addCard({ pipelineId: 'pipe_1', stageId: 'stage_1', objectId: 'obj_1' })
    ).resolves.toBeDefined();
    await expect(
      engine.moveCard({
        pipelineId: 'pipe_1',
        cardId: 'card_1',
        toStageId: 'stage_1',
        toPosition: 0,
      })
    ).resolves.toBeDefined();
    await expect(
      engine.removeCard({ pipelineId: 'pipe_1', cardId: 'card_1' })
    ).resolves.toBeDefined();
    const batch = await engine.addCardsBatch({
      pipelineId: 'pipe_1',
      stageId: 'stage_1',
      objectIds: ['obj_1'],
    });
    expect(batch.addedCardIds).toHaveLength(1);
    const removed = await engine.removeCardsBatch({
      pipelineId: 'pipe_1',
      cardIds: ['card_1'],
    });
    expect(removed.removed).toBe(1);
  });
});
