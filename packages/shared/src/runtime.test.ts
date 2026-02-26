import { describe, expect, it } from 'vitest';
import {
  DEFAULT_API_PORT,
  DEFAULT_API_BASE_URL,
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_GRAPH_QUEUE_NAME,
  DEFAULT_JOB_QUEUE_NAME,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_TRPC_PATH,
  DEFAULT_WEB_PORT,
  buildJobId,
  buildObjectReadyJobId,
  buildScoreBackfillDimensionJobId,
  buildScoreFoldEntityJobId,
  buildScoreObjectJobId,
  buildObjectCreatedJobId,
  buildStreamRunnerJobId,
} from './runtime';

describe('runtime defaults and job id builders', () => {
  it('exports stable runtime defaults', () => {
    expect(DEFAULT_API_PORT).toBe(4000);
    expect(DEFAULT_WEB_PORT).toBe(3333);
    expect(DEFAULT_TRPC_PATH).toBe('/trpc');
    expect(DEFAULT_JOB_QUEUE_NAME).toBe('psn.foundation');
    expect(DEFAULT_GRAPH_QUEUE_NAME).toBe('psn.object.created');
    expect(DEFAULT_API_BASE_URL).toBe('http://localhost:4000');
    expect(DEFAULT_OPENAI_BASE_URL).toBe('https://api.openai.com');
    expect(DEFAULT_ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com');
  });

  it('builds deterministic bullmq-safe job ids', () => {
    expect(buildJobId('stream-runner', 'stream_1')).toBe('stream-runner__stream_1');
    expect(buildStreamRunnerJobId('stream_1')).toBe('stream-runner__stream_1');
    expect(buildObjectCreatedJobId('run_1', 'obj_1')).toBe(
      'object-created__run_1__obj_1'
    );
    expect(buildObjectReadyJobId('obj_1')).toBe('object-ready__obj_1');
    expect(buildScoreObjectJobId('dim_1', 'obj_1')).toBe('score-object__dim_1__obj_1');
    expect(buildScoreFoldEntityJobId('dim_1', 'ent_1')).toBe('score-fold-entity__dim_1__ent_1');
    expect(buildScoreBackfillDimensionJobId('dim_1')).toBe('score-backfill-dimension__dim_1');
  });

  it('rejects invalid job id parts', () => {
    expect(() => buildJobId('stream__runner', 'stream_1')).toThrowError();
    expect(() => buildStreamRunnerJobId('stream:1')).toThrowError();
    expect(() => buildObjectCreatedJobId('run:1', 'obj_1')).toThrowError();
  });
});
