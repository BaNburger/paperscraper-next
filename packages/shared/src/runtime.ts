import { z } from 'zod';
import runtimeDefaults from './runtime-defaults.json';

const defaultsSchema = z.object({
  apiPort: z.number().int().positive(),
  webPort: z.number().int().positive(),
  trpcPath: z.string().min(1),
  jobQueueName: z.string().min(1),
  graphQueueName: z.string().min(1),
  healthProbeTimeoutMs: z.number().int().positive(),
  apiBaseUrl: z.string().url(),
  openAlexBaseUrl: z.string().url(),
  openAiBaseUrl: z.string().url(),
  anthropicBaseUrl: z.string().url(),
});

const validatedDefaults = defaultsSchema.parse(runtimeDefaults);

const jobIdPartSchema = z
  .string()
  .min(1)
  .refine((value) => !value.includes(':'), {
    message: 'Job id parts cannot contain colons.',
  });
const jobIdPrefixSchema = z
  .string()
  .min(1)
  .refine((value) => !value.includes('__'), {
    message: "Job id prefix cannot contain '__'.",
  });

export const DEFAULT_API_PORT = validatedDefaults.apiPort;
export const DEFAULT_WEB_PORT = validatedDefaults.webPort;
export const DEFAULT_TRPC_PATH = validatedDefaults.trpcPath;
export const DEFAULT_JOB_QUEUE_NAME = validatedDefaults.jobQueueName;
export const DEFAULT_GRAPH_QUEUE_NAME = validatedDefaults.graphQueueName;
export const DEFAULT_HEALTH_PROBE_TIMEOUT_MS = validatedDefaults.healthProbeTimeoutMs;
export const DEFAULT_API_BASE_URL = validatedDefaults.apiBaseUrl;
export const DEFAULT_OPENALEX_BASE_URL = validatedDefaults.openAlexBaseUrl;
export const DEFAULT_OPENAI_BASE_URL = validatedDefaults.openAiBaseUrl;
export const DEFAULT_ANTHROPIC_BASE_URL = validatedDefaults.anthropicBaseUrl;

function parseJobIdPart(value: string): string {
  return jobIdPartSchema.parse(value);
}

export function buildJobId(prefix: string, ...parts: string[]): string {
  const parsedPrefix = jobIdPrefixSchema.parse(prefix);
  const parsedParts = parts.map(parseJobIdPart);
  return [parsedPrefix, ...parsedParts].join('__');
}

export function buildStreamRunnerJobId(streamId: string): string {
  return buildJobId('stream-runner', streamId);
}

export function buildObjectCreatedJobId(streamRunId: string, objectId: string): string {
  return buildJobId('object-created', streamRunId, objectId);
}

export function buildObjectReadyJobId(objectId: string): string {
  return buildJobId('object-ready', objectId);
}

export function buildScoreObjectJobId(dimensionId: string, objectId: string): string {
  return buildJobId('score-object', dimensionId, objectId);
}

export function buildScoreFoldEntityJobId(dimensionId: string, entityId: string): string {
  return buildJobId('score-fold-entity', dimensionId, entityId);
}

export function buildScoreBackfillDimensionJobId(dimensionId: string): string {
  return buildJobId('score-backfill-dimension', dimensionId);
}
