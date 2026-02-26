import { describe, expect, it } from 'vitest';
import {
  ingestStreamJobPayloadSchema,
  ingestionRunLogSchema,
  healthSnapshotSchema,
  objectCreatedJobPayloadSchema,
  streamCreateInputSchema,
  streamQuerySchema,
  streamRunSchema,
  streamSchema,
  workerReadinessLogSchema,
} from './contracts';

describe('shared contracts', () => {
  it('accepts a valid health snapshot payload', () => {
    const parsed = healthSnapshotSchema.parse({
      status: 'ok',
      timestamp: '2026-02-24T00:00:00.000Z',
      dependencies: {
        postgres: { status: 'ready', latencyMs: 7 },
        redis: { status: 'ready', latencyMs: 3 },
      },
    });

    expect(parsed.status).toBe('ok');
  });

  it('validates worker readiness logs', () => {
    const parsed = workerReadinessLogSchema.parse({
      state: 'degraded',
      component: 'jobs-worker',
      attempt: 2,
      durationMs: 220,
      reason: 'Redis temporarily unavailable',
    });

    expect(parsed.component).toBe('jobs-worker');
  });

  it('validates ingestion run logs', () => {
    const parsed = ingestionRunLogSchema.parse({
      state: 'ready',
      component: 'jobs-worker',
      streamId: 'stream_1',
      runId: 'run_1',
      attempt: 1,
      durationMs: 175,
      queueDepth: {
        ingest: { waiting: 1, active: 1, delayed: 0, failed: 0 },
        graph: { waiting: 2, active: 0, delayed: 0, failed: 0 },
      },
      processedCount: 10,
      insertedCount: 3,
      updatedCount: 7,
      failedCount: 0,
    });

    expect(parsed.state).toBe('ready');
  });

  it('validates stream contracts and queue payloads', () => {
    expect(streamQuerySchema.parse('filter:publication_year:2024')).toContain('filter:');
    expect(streamQuerySchema.parse('search:graph neural network')).toContain('search:');

    const stream = streamSchema.parse({
      id: 'stream_1',
      name: 'OpenAlex Search',
      query: 'search:technology transfer',
      source: 'openalex',
      maxObjects: 100,
      isActive: true,
      createdAt: '2026-02-25T00:00:00.000Z',
      updatedAt: '2026-02-25T00:00:00.000Z',
    });
    expect(stream.source).toBe('openalex');

    const run = streamRunSchema.parse({
      id: 'run_1',
      streamId: 'stream_1',
      status: 'queued',
      startedAt: '2026-02-25T00:00:00.000Z',
      finishedAt: null,
      processedCount: 0,
      insertedCount: 0,
      updatedCount: 0,
      failedCount: 0,
      failureReason: null,
    });
    expect(run.status).toBe('queued');

    expect(
      streamCreateInputSchema.parse({
        name: 'OpenAlex Filter',
        query: 'filter:institutions.id:I12345',
        maxObjects: 250,
      }).maxObjects
    ).toBe(250);

    expect(
      ingestStreamJobPayloadSchema.parse({
        streamId: 'stream_1',
      }).streamId
    ).toBe('stream_1');

    expect(
      objectCreatedJobPayloadSchema.parse({
        objectId: 'obj_1',
        streamId: 'stream_1',
        streamRunId: 'run_1',
        source: 'openalex',
      }).source
    ).toBe('openalex');
  });
});
