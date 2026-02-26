import { describe, expect, it, vi } from 'vitest';
import { runIngestStreamRunner } from './stream-runner';

function createQueue() {
  return {
    add: vi.fn(async () => ({ id: 'job_1' })),
    getJob: vi.fn(async () => null),
    getJobCounts: vi.fn(async () => ({
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
    })),
  };
}

function createPrismaForRuns(runIds: string[]) {
  const runQueue = [...runIds];
  const streamRunUpdate = vi.fn(async () => ({ id: 'run' }));
  const streamRunObjectCreateMany = vi.fn(async () => ({ count: 1 }));

  const prisma = {
    stream: {
      findUnique: vi.fn(async () => ({
        id: 'stream_1',
        query: 'search:graph',
        maxObjects: 50,
        source: 'openalex',
      })),
    },
    streamRun: {
      findFirst: vi.fn(async () => {
        const id = runQueue.shift();
        return id ? { id } : null;
      }),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: streamRunUpdate,
    },
    streamRunObject: {
      createMany: streamRunObjectCreateMany,
    },
    researchObject: {
      findMany: vi.fn(async () => []),
      createManyAndReturn: vi.fn(async () => [{ id: 'obj_1' }]),
      create: vi.fn(async () => ({ id: 'obj_1' })),
      update: vi.fn(async () => ({ id: 'obj_1' })),
    },
  };

  return { prisma, streamRunUpdate, streamRunObjectCreateMany };
}

describe('stream runner', () => {
  it('processes a queued run and emits object.created for inserted rows', async () => {
    const ingestQueue = createQueue();
    const graphQueue = createQueue();
    const { prisma, streamRunUpdate, streamRunObjectCreateMany } = createPrismaForRuns([
      'run_1',
    ]);

    await runIngestStreamRunner(
      {
        prisma: prisma as never,
        ingestQueue: ingestQueue as never,
        graphQueue: graphQueue as never,
        fetchWorks: async () => ({
          works: [
            {
              id: 'https://openalex.org/W1',
              display_name: 'Title',
              publication_date: '2024-01-01',
              abstract_inverted_index: {
                title: [0],
              },
            },
          ],
          processedCount: 1,
          failedCount: 0,
        }),
        log: () => undefined,
      },
      { streamId: 'stream_1' }
    );

    expect(graphQueue.add).toHaveBeenCalledTimes(1);
    expect(streamRunObjectCreateMany).toHaveBeenCalledTimes(1);
    expect(streamRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'succeeded',
          processedCount: 1,
          insertedCount: 1,
          updatedCount: 0,
          failedCount: 0,
        }),
      })
    );
  });

  it('marks run as failed when ingestion throws', async () => {
    const ingestQueue = createQueue();
    const graphQueue = createQueue();
    const { prisma, streamRunUpdate } = createPrismaForRuns(['run_1']);

    await runIngestStreamRunner(
      {
        prisma: prisma as never,
        ingestQueue: ingestQueue as never,
        graphQueue: graphQueue as never,
        fetchWorks: async () => {
          throw new Error('OpenAlex outage');
        },
        log: () => undefined,
      },
      { streamId: 'stream_1' }
    );

    expect(streamRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
        }),
      })
    );
  });

  it('drains queued runs for the same stream in order', async () => {
    const ingestQueue = createQueue();
    const graphQueue = createQueue();
    const { prisma } = createPrismaForRuns(['run_1', 'run_2']);
    const fetchWorks = vi.fn(async () => ({
      works: [],
      processedCount: 0,
      failedCount: 0,
    }));

    await runIngestStreamRunner(
      {
        prisma: prisma as never,
        ingestQueue: ingestQueue as never,
        graphQueue: graphQueue as never,
        fetchWorks,
        log: () => undefined,
      },
      { streamId: 'stream_1' }
    );

    expect(fetchWorks).toHaveBeenCalledTimes(2);
  });

  it('runs claimed stream runs sequentially with no overlap', async () => {
    const ingestQueue = createQueue();
    const graphQueue = createQueue();
    const { prisma } = createPrismaForRuns(['run_1', 'run_2']);

    let inFlight = 0;
    let peakInFlight = 0;
    const fetchWorks = vi.fn(async () => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return {
        works: [],
        processedCount: 0,
        failedCount: 0,
      };
    });

    await runIngestStreamRunner(
      {
        prisma: prisma as never,
        ingestQueue: ingestQueue as never,
        graphQueue: graphQueue as never,
        fetchWorks,
        log: () => undefined,
      },
      { streamId: 'stream_1' }
    );

    expect(fetchWorks).toHaveBeenCalledTimes(2);
    expect(peakInFlight).toBe(1);
  });

});
