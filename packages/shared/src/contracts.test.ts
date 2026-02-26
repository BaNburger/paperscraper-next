import { describe, expect, it } from 'vitest';
import {
  apiKeyProviderStateSchema,
  apiKeyUpsertInputSchema,
  dimensionCreateInputSchema,
  dimensionSchema,
  ingestStreamJobPayloadSchema,
  ingestionRunLogSchema,
  healthSnapshotSchema,
  objectReadyJobPayloadSchema,
  objectCreatedJobPayloadSchema,
  scoreBackfillDimensionJobPayloadSchema,
  scoreObjectJobPayloadSchema,
  scoreOutputSchema,
  streamCreateInputSchema,
  streamQuerySchema,
  streamRunSchema,
  streamSchema,
  workerReadinessLogSchema,
} from './contracts';
import { foldRunLogSchema, graphRunLogSchema, scoringRunLogSchema } from './job-logs';

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

  it('validates dimension and score contracts', () => {
    const dimension = dimensionSchema.parse({
      id: 'dim_1',
      name: 'Novelty',
      prompt: 'Score novelty',
      provider: 'openai',
      model: 'gpt-4o-mini',
      isActive: true,
      createdAt: '2026-02-26T00:00:00.000Z',
      updatedAt: '2026-02-26T00:00:00.000Z',
    });
    expect(dimension.provider).toBe('openai');

    const createInput = dimensionCreateInputSchema.parse({
      name: 'Strategic fit',
      prompt: 'Score strategic fit',
      provider: 'anthropic',
      model: 'claude-3-5-haiku-latest',
    });
    expect(createInput.isActive).toBe(true);

    const score = scoreOutputSchema.parse({
      value: 87.5,
      explanation: 'Strong signal',
      metadata: { confidence: 0.82 },
    });
    expect(score.value).toBeGreaterThan(0);
  });

  it('validates graph and scoring queue payloads/log contracts', () => {
    expect(
      objectReadyJobPayloadSchema.parse({
        objectId: 'obj_1',
        source: 'openalex',
      }).source
    ).toBe('openalex');

    expect(
      scoreObjectJobPayloadSchema.parse({
        objectId: 'obj_1',
        dimensionId: 'dim_1',
        source: 'openalex',
      }).dimensionId
    ).toBe('dim_1');

    expect(
      scoreBackfillDimensionJobPayloadSchema.parse({
        dimensionId: 'dim_1',
      }).dimensionId
    ).toBe('dim_1');

    const graphLog = graphRunLogSchema.parse({
      state: 'ready',
      component: 'jobs-worker',
      objectId: 'obj_1',
      attempt: 1,
      durationMs: 14,
      linkedCount: 2,
      queueDepth: {
        graph: { waiting: 1, active: 0, delayed: 0, failed: 0 },
      },
    });
    expect(graphLog.linkedCount).toBe(2);

    const scoringLog = scoringRunLogSchema.parse({
      state: 'ready',
      component: 'jobs-worker',
      objectId: 'obj_1',
      dimensionId: 'dim_1',
      attempt: 1,
      durationMs: 27,
      scoreValue: 92,
      queueDepth: {
        graph: { waiting: 1, active: 1, delayed: 0, failed: 0 },
      },
    });
    expect(scoringLog.scoreValue).toBe(92);

    const foldLog = foldRunLogSchema.parse({
      state: 'ready',
      component: 'jobs-worker',
      entityId: 'ent_1',
      dimensionId: 'dim_1',
      attempt: 1,
      durationMs: 11,
      scoreValue: 88,
      sampleSize: 3,
      queueDepth: {
        graph: { waiting: 1, active: 0, delayed: 0, failed: 0 },
      },
    });
    expect(foldLog.sampleSize).toBe(3);
  });

  it('validates api key provider state contracts', () => {
    const upsert = apiKeyUpsertInputSchema.parse({
      provider: 'openai',
      apiKey: 'sk-test',
    });
    expect(upsert.provider).toBe('openai');

    const state = apiKeyProviderStateSchema.parse({
      provider: 'anthropic',
      status: 'configured',
      updatedAt: '2026-02-26T00:00:00.000Z',
      revokedAt: null,
    });
    expect(state.status).toBe('configured');
  });
});
