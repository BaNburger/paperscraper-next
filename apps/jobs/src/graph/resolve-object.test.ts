import { describe, expect, it, vi } from 'vitest';
import { runGraphResolveObject } from './resolve-object';

function createGraphQueue() {
  return {
    getJobCounts: vi.fn(async () => ({
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
    })),
    getJob: vi.fn(async () => null),
    add: vi.fn(async () => ({ id: 'job_1' })),
  };
}

describe('graph resolver', () => {
  it('reuses exact author entity and enqueues object.ready', async () => {
    const graphQueue = createGraphQueue();
    const prisma = {
      researchObject: {
        findUnique: vi.fn(async () => ({
          id: 'obj_1',
          sourceMetadata: {
            authorships: [{ authorId: 'https://openalex.org/A1', authorName: 'Ada Lovelace', position: 0 }],
          },
        })),
      },
      entity: {
        findFirst: vi.fn(async () => ({ id: 'ent_1' })),
        findMany: vi.fn(async () => []),
        create: vi.fn(async () => ({ id: 'ent_created' })),
      },
      objectEntity: {
        upsert: vi.fn(async () => ({ id: 'link_1' })),
      },
    };

    await runGraphResolveObject(
      {
        prisma: prisma as never,
        graphQueue: graphQueue as never,
        log: () => undefined,
      },
      {
        objectId: 'obj_1',
        streamId: 'stream_1',
        streamRunId: 'run_1',
        source: 'openalex',
      }
    );

    expect(prisma.entity.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.entity.create).not.toHaveBeenCalled();
    expect(prisma.objectEntity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          objectId: 'obj_1',
          entityId: 'ent_1',
          role: 'author',
          position: 0,
        }),
      })
    );
    expect(graphQueue.add).toHaveBeenCalledTimes(1);
  });

  it('creates new entity when fuzzy match is ambiguous', async () => {
    const graphQueue = createGraphQueue();
    const prisma = {
      researchObject: {
        findUnique: vi.fn(async () => ({
          id: 'obj_1',
          sourceMetadata: {
            authorships: [{ authorId: null, authorName: 'John Smith', position: 0 }],
          },
        })),
      },
      entity: {
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => [
          { id: 'ent_a', name: 'John Smith' },
          { id: 'ent_b', name: 'John Smith' },
        ]),
        create: vi.fn(async () => ({ id: 'ent_new' })),
      },
      objectEntity: {
        upsert: vi.fn(async () => ({ id: 'link_1' })),
      },
    };

    await runGraphResolveObject(
      {
        prisma: prisma as never,
        graphQueue: graphQueue as never,
        log: () => undefined,
      },
      {
        objectId: 'obj_1',
        streamId: 'stream_1',
        streamRunId: 'run_1',
        source: 'openalex',
      }
    );

    expect(prisma.entity.create).toHaveBeenCalledTimes(1);
    expect(prisma.objectEntity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ entityId: 'ent_new' }),
      })
    );
  });
});
