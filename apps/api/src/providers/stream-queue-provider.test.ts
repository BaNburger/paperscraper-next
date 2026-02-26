import { describe, expect, it, vi } from 'vitest';
import { buildStreamRunnerJobId } from '@paperscraper/shared';
import { enqueueStreamRunner } from './stream-queue-provider';

describe('stream queue provider', () => {
  it('enqueues a deterministic stream runner job id', async () => {
    const add = vi.fn(async () => ({ id: 'job_1' }));
    const queue = {
      getJob: vi.fn(async () => null),
      add,
    };

    await enqueueStreamRunner(queue as never, 'stream_1');

    expect(add).toHaveBeenCalledWith(
      'ingest.stream.runner.v1',
      { streamId: 'stream_1' },
      expect.objectContaining({
        jobId: buildStreamRunnerJobId('stream_1'),
      })
    );
  });

  it('returns early when the stream runner job already exists', async () => {
    const queue = {
      getJob: vi.fn(async () => ({ id: 'existing' })),
      add: vi.fn(),
    };

    await enqueueStreamRunner(queue as never, 'stream_1');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('ignores duplicate enqueue race errors', async () => {
    const queue = {
      getJob: vi.fn(async () => null),
      add: vi.fn(async () => {
        throw new Error('job already exists');
      }),
    };

    await expect(enqueueStreamRunner(queue as never, 'stream_1')).resolves.toBeUndefined();
  });

  it('rejects invalid stream ids that cannot form a safe job id', async () => {
    const queue = {
      getJob: vi.fn(async () => null),
      add: vi.fn(),
    };

    await expect(enqueueStreamRunner(queue as never, 'stream:unsafe')).rejects.toBeInstanceOf(Error);
    expect(queue.add).not.toHaveBeenCalled();
  });
});
