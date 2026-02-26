import { z } from 'zod';
import {
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_GRAPH_QUEUE_NAME,
  DEFAULT_JOB_QUEUE_NAME,
  DEFAULT_OPENAI_BASE_URL,
  DEFAULT_OPENALEX_BASE_URL,
} from '@paperscraper/shared';

const jobsEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JOB_QUEUE_NAME: z.string().min(1).default(DEFAULT_JOB_QUEUE_NAME),
  GRAPH_QUEUE_NAME: z.string().min(1).default(DEFAULT_GRAPH_QUEUE_NAME),
  JOB_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  GRAPH_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  JOB_READINESS_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  JOB_READINESS_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
  SECRETS_MASTER_KEY: z.string().optional(),
  OPENALEX_API_KEY: z.string().optional().default(''),
  OPENALEX_BASE_URL: z.string().url().default(DEFAULT_OPENALEX_BASE_URL),
  OPENALEX_TIMEOUT_MS: z.coerce.number().int().positive().default(6000),
  OPENALEX_MAX_RETRIES: z.coerce.number().int().positive().default(3),
  OPENALEX_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(250),
  OPENAI_BASE_URL: z.string().url().default(DEFAULT_OPENAI_BASE_URL),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(6000),
  OPENAI_MAX_RETRIES: z.coerce.number().int().positive().default(2),
  OPENAI_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(250),
  ANTHROPIC_BASE_URL: z.string().url().default(DEFAULT_ANTHROPIC_BASE_URL),
  ANTHROPIC_TIMEOUT_MS: z.coerce.number().int().positive().default(6000),
  ANTHROPIC_MAX_RETRIES: z.coerce.number().int().positive().default(2),
  ANTHROPIC_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(250),
});

export type JobsEnv = z.infer<typeof jobsEnvSchema>;

export function loadJobsEnv(env: NodeJS.ProcessEnv = process.env): JobsEnv {
  return jobsEnvSchema.parse(env);
}
