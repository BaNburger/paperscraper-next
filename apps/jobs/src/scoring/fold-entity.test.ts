import { afterEach, describe, expect, it, vi } from 'vitest';
import { runFoldEntityScore } from './fold-entity';

function createGraphQueue() {
  return {
    getJobCounts: vi.fn(async () => ({
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
    })),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fold entity score', () => {
  it('recomputes recency-weighted aggregate and upserts entity score', async () => {
    const now = new Date('2026-02-26T00:00:00.000Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const prisma = {
      objectEntity: {
        findMany: vi.fn(async () => [
          {
            object: {
              publishedAt: new Date('2026-02-26T00:00:00.000Z'),
              createdAt: new Date('2026-02-26T00:00:00.000Z'),
              scores: [{ value: 100 }],
            },
          },
          {
            object: {
              publishedAt: new Date('2025-02-26T00:00:00.000Z'),
              createdAt: new Date('2025-02-26T00:00:00.000Z'),
              scores: [{ value: 50 }],
            },
          },
        ]),
      },
      entityScore: {
        upsert: vi.fn(async () => ({ id: 'entity_score_1' })),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
    };

    await runFoldEntityScore(
      {
        prisma: prisma as never,
        graphQueue: createGraphQueue() as never,
        log: () => undefined,
      },
      { entityId: 'ent_1', dimensionId: 'dim_1' }
    );

    expect(prisma.entityScore.upsert).toHaveBeenCalledTimes(1);
    const upsertMock = prisma.entityScore.upsert as unknown as {
      mock: { calls: Array<[Record<string, unknown>]> };
    };
    const upsertArgs = upsertMock.mock.calls[0]?.[0];
    expect((upsertArgs as { create: { value: number } } | undefined)?.create.value).toBeCloseTo(83.3333, 3);
    expect(prisma.entityScore.deleteMany).not.toHaveBeenCalled();
  });

  it('clears fold-up score when no object scores are present', async () => {
    const prisma = {
      objectEntity: {
        findMany: vi.fn(async () => [
          {
            object: {
              publishedAt: new Date('2026-02-26T00:00:00.000Z'),
              createdAt: new Date('2026-02-26T00:00:00.000Z'),
              scores: [],
            },
          },
        ]),
      },
      entityScore: {
        upsert: vi.fn(async () => ({ id: 'entity_score_1' })),
        deleteMany: vi.fn(async () => ({ count: 1 })),
      },
    };

    await runFoldEntityScore(
      {
        prisma: prisma as never,
        graphQueue: createGraphQueue() as never,
        log: () => undefined,
      },
      { entityId: 'ent_1', dimensionId: 'dim_1' }
    );

    expect(prisma.entityScore.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.entityScore.upsert).not.toHaveBeenCalled();
  });
});
