import { describe, expect, it, vi } from 'vitest';
import { createStreamsEngine } from './streams-engine';

function createFakeEngine(overrides: Partial<Parameters<typeof createStreamsEngine>[0]> = {}) {
  const stream = {
    id: 'stream_1',
    name: 'Stream',
    query: 'search:paper',
    source: 'openalex' as const,
    maxObjects: 100,
    isActive: true,
    createdAt: new Date('2026-02-25T00:00:00.000Z'),
    updatedAt: new Date('2026-02-25T00:00:00.000Z'),
  };
  const run = {
    id: 'run_1',
    streamId: 'stream_1',
    status: 'queued' as const,
    startedAt: new Date('2026-02-25T00:00:00.000Z'),
    finishedAt: null,
    processedCount: 0,
    insertedCount: 0,
    updatedCount: 0,
    failedCount: 0,
    failureReason: null,
  };

  const deps: Parameters<typeof createStreamsEngine>[0] = {
    listStreams: async () => [stream],
    createStream: async (input) => ({ ...stream, ...input, maxObjects: input.maxObjects ?? 100 }),
    getStreamById: async () => stream,
    countQueuedOrRunningRuns: async () => 0,
    updateStream: async (_id, patch) => ({ ...stream, ...patch, updatedAt: new Date() }),
    createQueuedRun: async () => run,
    markRunFailed: async () => undefined,
    listRuns: async () => [run],
    enqueueStreamRunner: async () => undefined,
    ...overrides,
  };

  return createStreamsEngine(deps);
}

describe('streams engine', () => {
  it('lists streams and returns normalized DTO', async () => {
    const engine = createFakeEngine();
    const streams = await engine.list({ includeInactive: true });

    expect(streams).toHaveLength(1);
    expect(streams[0]!.source).toBe('openalex');
  });

  it('rejects updates while runs are active', async () => {
    const engine = createFakeEngine({
      countQueuedOrRunningRuns: async () => 1,
    });

    await expect(
      engine.update({
        id: 'stream_1',
        name: 'updated',
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('marks run failed when enqueue fails', async () => {
    const markRunFailed = vi.fn(async () => undefined);
    const engine = createFakeEngine({
      enqueueStreamRunner: async () => {
        throw new Error('redis unavailable');
      },
      markRunFailed,
    });

    await expect(engine.trigger({ id: 'stream_1' })).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
    });
    expect(markRunFailed).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid stream query syntax', async () => {
    const engine = createFakeEngine();
    await expect(
      engine.create({
        name: 'Invalid stream',
        query: 'publication_year:2024',
      } as never)
    ).rejects.toMatchObject({ name: 'ZodError' });
  });

  it('soft deletes streams by setting isActive false', async () => {
    const updateStream = vi.fn(async (_id, patch) => ({
      id: 'stream_1',
      name: 'Stream',
      query: 'search:paper',
      source: 'openalex' as const,
      maxObjects: 100,
      isActive: patch.isActive ?? true,
      createdAt: new Date('2026-02-25T00:00:00.000Z'),
      updatedAt: new Date('2026-02-25T00:00:00.000Z'),
    }));
    const engine = createFakeEngine({ updateStream });
    const stream = await engine.delete({ id: 'stream_1' });

    expect(stream.isActive).toBe(false);
    expect(updateStream).toHaveBeenCalledWith('stream_1', { isActive: false });
  });
});
