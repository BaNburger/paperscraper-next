import { z } from 'zod';
import { readinessStateSchema, scoreValueSchema } from './contracts';

const queueDepthSchema = z.object({
  waiting: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  delayed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

const graphQueueDepthSchema = z.object({
  graph: queueDepthSchema,
});
export type GraphQueueDepthSnapshot = z.infer<typeof graphQueueDepthSchema>;

export const graphRunLogSchema = z.object({
  state: readinessStateSchema,
  component: z.literal('jobs-worker'),
  objectId: z.string().min(1),
  attempt: z.number().int().positive(),
  durationMs: z.number().int().nonnegative(),
  reason: z.string().min(1).optional(),
  linkedCount: z.number().int().nonnegative().optional(),
  queueDepth: graphQueueDepthSchema.optional(),
});
export type GraphRunLog = z.infer<typeof graphRunLogSchema>;

export const scoringRunLogSchema = z.object({
  state: readinessStateSchema,
  component: z.literal('jobs-worker'),
  objectId: z.string().min(1),
  dimensionId: z.string().min(1),
  attempt: z.number().int().positive(),
  durationMs: z.number().int().nonnegative(),
  reason: z.string().min(1).optional(),
  scoreValue: scoreValueSchema.optional(),
  queueDepth: graphQueueDepthSchema.optional(),
});
export type ScoringRunLog = z.infer<typeof scoringRunLogSchema>;

export const foldRunLogSchema = z.object({
  state: readinessStateSchema,
  component: z.literal('jobs-worker'),
  entityId: z.string().min(1),
  dimensionId: z.string().min(1),
  attempt: z.number().int().positive(),
  durationMs: z.number().int().nonnegative(),
  reason: z.string().min(1).optional(),
  scoreValue: scoreValueSchema.optional(),
  sampleSize: z.number().int().nonnegative().optional(),
  queueDepth: graphQueueDepthSchema.optional(),
});
export type FoldRunLog = z.infer<typeof foldRunLogSchema>;
