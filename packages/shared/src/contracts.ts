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

export const apiErrorEnvelopeSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional(),
});
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
