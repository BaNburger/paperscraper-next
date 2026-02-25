import { z } from 'zod';

const apiEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(4000),
  TRPC_PATH: z.string().min(1).default('/trpc'),
  HEALTH_PROBE_TIMEOUT_MS: z.coerce.number().int().positive().default(1000),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  return apiEnvSchema.parse(env);
}
