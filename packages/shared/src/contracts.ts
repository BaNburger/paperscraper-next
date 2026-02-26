import { z } from 'zod';

export const readinessStateSchema = z.enum(['ready', 'degraded', 'failed']);
export type ReadinessState = z.infer<typeof readinessStateSchema>;

export const dependencyHealthSchema = z.object({
  status: readinessStateSchema,
  latencyMs: z.number().int().nonnegative().optional(),
  reason: z.string().min(1).optional(),
});
export type DependencyHealth = z.infer<typeof dependencyHealthSchema>;

export const healthStatusSchema = z.enum(['ok', 'degraded', 'failed']);
export type HealthStatus = z.infer<typeof healthStatusSchema>;

export const healthSnapshotSchema = z.object({
  status: healthStatusSchema,
  timestamp: z.string().min(1),
  dependencies: z.object({
    postgres: dependencyHealthSchema,
    redis: dependencyHealthSchema,
  }),
  diagnostics: z
    .object({
      reason: z.string().min(1).optional(),
    })
    .optional(),
});
export type HealthSnapshot = z.infer<typeof healthSnapshotSchema>;

export const workerReadinessLogSchema = z.object({
  state: readinessStateSchema,
  component: z.literal('jobs-worker'),
  attempt: z.number().int().positive(),
  durationMs: z.number().int().nonnegative(),
  reason: z.string().min(1).optional(),
});
export type WorkerReadinessLog = z.infer<typeof workerReadinessLogSchema>;

const queueDepthSchema = z.object({
  waiting: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  delayed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
export type QueueDepthSnapshot = z.infer<typeof queueDepthSchema>;

export const ingestionLogStateSchema = z.enum([
  'running',
  'ready',
  'degraded',
  'failed',
]);
export type IngestionLogState = z.infer<typeof ingestionLogStateSchema>;

export const ingestionRunLogSchema = z.object({
  state: ingestionLogStateSchema,
  component: z.literal('jobs-worker'),
  streamId: z.string().min(1),
  runId: z.string().min(1),
  attempt: z.number().int().positive(),
  durationMs: z.number().int().nonnegative(),
  reason: z.string().min(1).optional(),
  queueDepth: z
    .object({
      ingest: queueDepthSchema,
      graph: queueDepthSchema,
    })
    .optional(),
  processedCount: z.number().int().nonnegative().optional(),
  insertedCount: z.number().int().nonnegative().optional(),
  updatedCount: z.number().int().nonnegative().optional(),
  failedCount: z.number().int().nonnegative().optional(),
});
export type IngestionRunLog = z.infer<typeof ingestionRunLogSchema>;

export const apiErrorEnvelopeSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;

export const streamRunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export type StreamRunStatus = z.infer<typeof streamRunStatusSchema>;

export const streamSourceSchema = z.enum(['openalex']);
export type StreamSource = z.infer<typeof streamSourceSchema>;
export const scoringProviderSchema = z.enum(['openai', 'anthropic']);
export type ScoringProvider = z.infer<typeof scoringProviderSchema>;

const filterQuerySchema = z
  .string()
  .min('filter:'.length + 1)
  .startsWith('filter:')
  .refine((value) => value.slice('filter:'.length).trim().length > 0, {
    message: "Filter query must include content after 'filter:'",
  });

const searchQuerySchema = z
  .string()
  .min('search:'.length + 1)
  .startsWith('search:')
  .refine((value) => value.slice('search:'.length).trim().length > 0, {
    message: "Search query must include content after 'search:'",
  });

export const streamQuerySchema = z.union([filterQuerySchema, searchQuerySchema]);
export type StreamQuery = z.infer<typeof streamQuerySchema>;

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const streamSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  query: streamQuerySchema,
  source: streamSourceSchema,
  maxObjects: z.number().int().min(1).max(500),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type StreamDto = z.infer<typeof streamSchema>;

export const streamRunSchema = z.object({
  id: z.string().min(1),
  streamId: z.string().min(1),
  status: streamRunStatusSchema,
  startedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable(),
  processedCount: z.number().int().min(0),
  insertedCount: z.number().int().min(0),
  updatedCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  failureReason: z.string().min(1).nullable(),
});
export type StreamRunDto = z.infer<typeof streamRunSchema>;

export const streamsListInputSchema = z.object({
  includeInactive: z.boolean().optional().default(false),
});
export type StreamsListInput = z.infer<typeof streamsListInputSchema>;

export const streamCreateInputSchema = z.object({
  name: z.string().min(1),
  query: streamQuerySchema,
  maxObjects: z.number().int().min(1).max(500).optional(),
});
export type StreamCreateInput = z.infer<typeof streamCreateInputSchema>;

export const streamUpdateInputSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    query: streamQuerySchema.optional(),
    maxObjects: z.number().int().min(1).max(500).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.query !== undefined ||
      value.maxObjects !== undefined ||
      value.isActive !== undefined,
    {
      message: 'At least one field must be provided for update.',
      path: ['id'],
    }
  );
export type StreamUpdateInput = z.infer<typeof streamUpdateInputSchema>;

export const streamDeleteInputSchema = z.object({
  id: z.string().min(1),
});
export type StreamDeleteInput = z.infer<typeof streamDeleteInputSchema>;

export const streamTriggerInputSchema = z.object({
  id: z.string().min(1),
});
export type StreamTriggerInput = z.infer<typeof streamTriggerInputSchema>;

export const streamRunsInputSchema = z.object({
  streamId: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});
export type StreamRunsInput = z.infer<typeof streamRunsInputSchema>;

export const dimensionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  prompt: z.string().min(1),
  provider: scoringProviderSchema,
  model: z.string().min(1),
  isActive: z.boolean(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type DimensionDto = z.infer<typeof dimensionSchema>;

export const dimensionsListInputSchema = z.object({
  includeInactive: z.boolean().optional().default(false),
});
export type DimensionsListInput = z.infer<typeof dimensionsListInputSchema>;

export const dimensionCreateInputSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1),
  provider: scoringProviderSchema,
  model: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});
export type DimensionCreateInput = z.infer<typeof dimensionCreateInputSchema>;

export const dimensionUpdateInputSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    provider: scoringProviderSchema.optional(),
    model: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.prompt !== undefined ||
      value.provider !== undefined ||
      value.model !== undefined ||
      value.isActive !== undefined,
    {
      message: 'At least one field must be provided for update.',
      path: ['id'],
    }
  );
export type DimensionUpdateInput = z.infer<typeof dimensionUpdateInputSchema>;

export const dimensionDeleteInputSchema = z.object({
  id: z.string().min(1),
});
export type DimensionDeleteInput = z.infer<typeof dimensionDeleteInputSchema>;

export const apiKeyStatusSchema = z.enum(['configured', 'revoked', 'missing']);
export type ApiKeyStatus = z.infer<typeof apiKeyStatusSchema>;

export const apiKeyProviderStateSchema = z.object({
  provider: scoringProviderSchema,
  status: apiKeyStatusSchema,
  updatedAt: isoDateTimeSchema.nullable(),
  revokedAt: isoDateTimeSchema.nullable(),
});
export type ApiKeyProviderState = z.infer<typeof apiKeyProviderStateSchema>;

export const apiKeyUpsertInputSchema = z.object({
  provider: scoringProviderSchema,
  apiKey: z.string().min(1),
});
export type ApiKeyUpsertInput = z.infer<typeof apiKeyUpsertInputSchema>;

export const apiKeyRevokeInputSchema = z.object({
  provider: scoringProviderSchema,
});
export type ApiKeyRevokeInput = z.infer<typeof apiKeyRevokeInputSchema>;

export const scoreValueSchema = z.number().finite().min(0).max(100);
export type ScoreValue = z.infer<typeof scoreValueSchema>;

export const scoreOutputSchema = z.object({
  value: scoreValueSchema,
  explanation: z.string().min(1),
  metadata: z.unknown().optional(),
});
export type ScoreOutput = z.infer<typeof scoreOutputSchema>;

export const scoreBackfillDimensionInputSchema = z.object({
  dimensionId: z.string().min(1),
});
export type ScoreBackfillDimensionInput = z.infer<typeof scoreBackfillDimensionInputSchema>;

export const scoreBackfillKickoffSchema = z.object({
  dimensionId: z.string().min(1),
  jobId: z.string().min(1),
  status: z.literal('queued'),
  queuedAt: isoDateTimeSchema,
});
export type ScoreBackfillKickoff = z.infer<typeof scoreBackfillKickoffSchema>;

export const ingestStreamJobPayloadSchema = z.object({
  streamId: z.string().min(1),
});
export type IngestStreamJobPayload = z.infer<typeof ingestStreamJobPayloadSchema>;
export const INGEST_STREAM_RUNNER_JOB_NAME = 'ingest.stream.runner.v1';

export const objectCreatedJobPayloadSchema = z.object({
  objectId: z.string().min(1),
  streamId: z.string().min(1),
  streamRunId: z.string().min(1),
  source: streamSourceSchema,
});
export type ObjectCreatedJobPayload = z.infer<typeof objectCreatedJobPayloadSchema>;
export const OBJECT_CREATED_JOB_NAME = 'object.created.v1';

export const objectReadyJobPayloadSchema = z.object({
  objectId: z.string().min(1),
  source: streamSourceSchema,
});
export type ObjectReadyJobPayload = z.infer<typeof objectReadyJobPayloadSchema>;
export const OBJECT_READY_JOB_NAME = 'object.ready.v1';

export const scoreObjectJobPayloadSchema = z.object({
  objectId: z.string().min(1),
  dimensionId: z.string().min(1),
  source: streamSourceSchema,
});
export type ScoreObjectJobPayload = z.infer<typeof scoreObjectJobPayloadSchema>;
export const SCORE_OBJECT_JOB_NAME = 'score.object.v1';

export const scoreFoldEntityJobPayloadSchema = z.object({
  dimensionId: z.string().min(1),
  entityId: z.string().min(1),
});
export type ScoreFoldEntityJobPayload = z.infer<typeof scoreFoldEntityJobPayloadSchema>;
export const SCORE_FOLD_ENTITY_JOB_NAME = 'score.foldEntity.v1';

export const scoreBackfillDimensionJobPayloadSchema = z.object({
  dimensionId: z.string().min(1),
});
export type ScoreBackfillDimensionJobPayload = z.infer<typeof scoreBackfillDimensionJobPayloadSchema>;
export const SCORE_BACKFILL_DIMENSION_JOB_NAME = 'score.backfill.dimension.v1';
