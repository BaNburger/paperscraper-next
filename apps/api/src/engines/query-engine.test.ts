import { describe, expect, it } from 'vitest';
import { createQueryEngine } from './query-engine';

function createEngine() {
  return createQueryEngine({
    feedObjects: async () => ({
      items: [
        {
          id: 'obj_1',
          externalId: 'https://openalex.org/W1',
          source: 'openalex',
          title: 'Title',
          publishedAt: '2026-01-01T00:00:00.000Z',
          topScore: 88,
          stage: null,
          entities: [],
        },
      ],
      nextCursor: null,
    }),
    getObjectDetail: async (objectId) =>
      objectId === 'obj_1'
        ? {
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
          }
        : null,
    getEntityDetail: async (entityId) =>
      entityId === 'ent_1'
        ? {
            id: 'ent_1',
            name: 'Ada',
            kind: 'author',
            externalId: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            scores: [],
            relatedObjects: [],
          }
        : null,
  });
}

describe('query engine', () => {
  it('returns feed payload with schema validation', async () => {
    const engine = createEngine();
    const feed = await engine.feed({ sortBy: 'topScore', limit: 20 });

    expect(feed.items).toHaveLength(1);
    expect(feed.items[0]!.id).toBe('obj_1');
  });

  it('returns object detail and throws when missing', async () => {
    const engine = createEngine();
    const detail = await engine.objectDetail({ objectId: 'obj_1' });
    expect(detail.id).toBe('obj_1');
    await expect(engine.objectDetail({ objectId: 'missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('returns entity detail and throws when missing', async () => {
    const engine = createEngine();
    const detail = await engine.entityDetail({ entityId: 'ent_1' });
    expect(detail.id).toBe('ent_1');
    await expect(engine.entityDetail({ entityId: 'missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
