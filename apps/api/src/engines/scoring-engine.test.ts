import { describe, expect, it, vi } from 'vitest';
import { createScoringEngine } from './scoring-engine';

function createFakeEngine(overrides: Partial<Parameters<typeof createScoringEngine>[0]> = {}) {
  const dimension = {
    id: 'dim_1',
    name: 'Novelty',
    prompt: 'Score novelty',
    provider: 'openai' as const,
    model: 'gpt-4o-mini',
    isActive: true,
    createdAt: new Date('2026-02-26T00:00:00.000Z'),
    updatedAt: new Date('2026-02-26T00:00:00.000Z'),
  };

  const deps: Parameters<typeof createScoringEngine>[0] = {
    listDimensions: async () => [dimension],
    createDimension: async (input) => ({ ...dimension, ...input }),
    getDimensionById: async () => dimension,
    updateDimension: async (_id, patch) => ({ ...dimension, ...patch, updatedAt: new Date() }),
    enqueueBackfillDimension: async () => 'score-backfill-dimension__dim_1',
    ...overrides,
  };

  return createScoringEngine(deps);
}

describe('scoring engine', () => {
  it('lists dimensions as DTOs', async () => {
    const engine = createFakeEngine();
    const dimensions = await engine.list({ includeInactive: true });
    expect(dimensions).toHaveLength(1);
    expect(dimensions[0]?.provider).toBe('openai');
  });

  it('soft deletes dimensions by setting isActive false', async () => {
    const updateDimension = vi.fn(async (_id, patch) => ({
      id: 'dim_1',
      name: 'Novelty',
      prompt: 'Score novelty',
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      isActive: patch.isActive ?? true,
      createdAt: new Date('2026-02-26T00:00:00.000Z'),
      updatedAt: new Date('2026-02-26T00:00:00.000Z'),
    }));
    const engine = createFakeEngine({ updateDimension });
    const dimension = await engine.delete({ id: 'dim_1' });
    expect(dimension.isActive).toBe(false);
    expect(updateDimension).toHaveBeenCalledWith('dim_1', { isActive: false });
  });

  it('rejects backfill for inactive dimensions', async () => {
    const engine = createFakeEngine({
      getDimensionById: async () => ({
        id: 'dim_1',
        name: 'Novelty',
        prompt: 'Score novelty',
        provider: 'openai',
        model: 'gpt-4o-mini',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
    await expect(engine.backfillDimension({ dimensionId: 'dim_1' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('enqueues backfill and returns kickoff payload', async () => {
    const engine = createFakeEngine({
      enqueueBackfillDimension: async () => 'score-backfill-dimension__dim_1',
    });
    const kickoff = await engine.backfillDimension({ dimensionId: 'dim_1' });
    expect(kickoff.status).toBe('queued');
    expect(kickoff.jobId).toBe('score-backfill-dimension__dim_1');
  });
});
