import { describe, expect, it, vi } from 'vitest';
import { persistResearchObjects } from './stream-persistence';

describe('stream persistence', () => {
  it('returns touched ids for inserted and updated rows', async () => {
    const prisma = {
      researchObject: {
        findMany: vi.fn(async () => [{ id: 'obj_existing', externalId: 'https://openalex.org/W1' }]),
        createManyAndReturn: vi.fn(async () => [{ id: 'obj_inserted' }]),
        create: vi.fn(async () => ({ id: 'obj_inserted' })),
        update: vi.fn(async () => ({ id: 'obj_existing' })),
      },
    };

    const result = await persistResearchObjects(prisma as never, [
      {
        externalId: 'https://openalex.org/W1',
        source: 'openalex',
        title: 'Updated',
        abstract: null,
        sourceMetadata: null,
        publishedAt: null,
      },
      {
        externalId: 'https://openalex.org/W2',
        source: 'openalex',
        title: 'Inserted',
        abstract: null,
        sourceMetadata: null,
        publishedAt: null,
      },
    ]);

    expect(result.insertedCount).toBe(1);
    expect(result.updatedCount).toBe(1);
    expect(result.touchedObjectIds).toContain('obj_inserted');
    expect(result.touchedObjectIds).toContain('obj_existing');
  });
});
