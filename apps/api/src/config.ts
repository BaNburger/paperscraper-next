import { z } from 'zod';
import {
  DEFAULT_API_PORT,
  DEFAULT_HEALTH_PROBE_TIMEOUT_MS,
  DEFAULT_JOB_QUEUE_NAME,
  DEFAULT_TRPC_PATH,
} from '@paperscraper/shared';

const apiEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(DEFAULT_API_PORT),
  TRPC_PATH: z.string().min(1).default(DEFAULT_TRPC_PATH),
  HEALTH_PROBE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_HEALTH_PROBE_TIMEOUT_MS),
  JOB_QUEUE_NAME: z.string().min(1).default(DEFAULT_JOB_QUEUE_NAME),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(env);
}
