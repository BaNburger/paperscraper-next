import { describe, expect, it, vi } from 'vitest';
import {
  addJobIfMissing,
  createStandardJobOptions,
  isDuplicateJobError,
} from './queue-utils';

describe('queue utils', () => {
  it('returns false when a job already exists', async () => {
    const queue = {
      getJob: vi.fn(async () => ({ id: 'existing' })),
      add: vi.fn(async () => ({ id: 'new' })),
    };
    const added = await addJobIfMissing(
      queue as never,
      'job.name',
      { ok: true },
      createStandardJobOptions('job_1', 3)
    );
    expect(added).toBe(false);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns false on duplicate-job error race', async () => {
    const queue = {
      getJob: vi.fn(async () => null),
      add: vi.fn(async () => {
        throw new Error('Job with id already exists');
      }),
    };
    const added = await addJobIfMissing(
      queue as never,
      'job.name',
      { ok: true },
      createStandardJobOptions('job_1', 3)
    );
    expect(added).toBe(false);
  });

  it('identifies duplicate job errors', () => {
    expect(isDuplicateJobError(new Error('job already exists'))).toBe(true);
    expect(isDuplicateJobError(new Error('other error'))).toBe(false);
  });
});
