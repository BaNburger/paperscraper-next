import { z } from 'zod';

const jobsEnvSchema = z.object({
  REDIS_URL: z.string().min(1),
  JOB_QUEUE_NAME: z.string().min(1).default('psn.foundation'),
  JOB_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  JOB_READINESS_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  JOB_READINESS_BASE_DELAY_MS: z.coerce.number().int().positive().default(200),
});

export type JobsEnv = z.infer<typeof jobsEnvSchema>;

export function loadJobsEnv(env: NodeJS.ProcessEnv = process.env): JobsEnv {
  return jobsEnvSchema.parse(env);
}
