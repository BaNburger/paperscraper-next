import { z } from 'zod';
import { scoreValueSchema, streamSourceSchema } from './contracts';

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const feedSortSchema = z.enum(['topScore', 'publishedAt']);
export type FeedSort = z.infer<typeof feedSortSchema>;

export const objectsFeedInputSchema = z.object({
  query: z.string().trim().min(1).optional(),
  streamId: z.string().min(1).optional(),
  pipelineId: z.string().min(1).optional(),
  stageId: z.string().min(1).optional(),
  sortBy: feedSortSchema.optional().default('topScore'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().min(1).optional(),
});
export type ObjectsFeedInput = z.infer<typeof objectsFeedInputSchema>;

export const feedEntityPreviewSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
});
export type FeedEntityPreview = z.infer<typeof feedEntityPreviewSchema>;

export const objectFeedItemSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  source: streamSourceSchema,
  title: z.string().min(1),
  publishedAt: isoDateTimeSchema.nullable(),
  topScore: scoreValueSchema.nullable(),
  stage: z
    .object({
      pipelineId: z.string().min(1),
      stageId: z.string().min(1),
      stageName: z.string().min(1),
      position: z.number().int().nonnegative(),
    })
    .nullable(),
  entities: z.array(feedEntityPreviewSchema).max(3),
});
export type ObjectFeedItem = z.infer<typeof objectFeedItemSchema>;

export const objectsFeedOutputSchema = z.object({
  items: z.array(objectFeedItemSchema),
  nextCursor: z.string().nullable(),
});
export type ObjectsFeedOutput = z.infer<typeof objectsFeedOutputSchema>;

export const objectScoreDetailSchema = z.object({
  dimensionId: z.string().min(1),
  dimensionName: z.string().min(1),
  value: scoreValueSchema,
  explanation: z.string().min(1),
  metadata: z.unknown().optional(),
  updatedAt: isoDateTimeSchema,
});
export type ObjectScoreDetail = z.infer<typeof objectScoreDetailSchema>;

export const objectEntityLinkSchema = z.object({
  entityId: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  externalId: z.string().nullable(),
  role: z.string().min(1),
  position: z.number().int().nonnegative().nullable(),
});
export type ObjectEntityLink = z.infer<typeof objectEntityLinkSchema>;

export const objectPipelineCardSchema = z.object({
  cardId: z.string().min(1),
  pipelineId: z.string().min(1),
  pipelineName: z.string().min(1),
  stageId: z.string().min(1),
  stageName: z.string().min(1),
  position: z.number().int().nonnegative(),
});
export type ObjectPipelineCard = z.infer<typeof objectPipelineCardSchema>;

export const objectDetailOutputSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().min(1),
  source: streamSourceSchema,
  title: z.string().min(1),
  abstract: z.string().nullable(),
  publishedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  scores: z.array(objectScoreDetailSchema),
  entities: z.array(objectEntityLinkSchema),
  pipelineCards: z.array(objectPipelineCardSchema),
});
export type ObjectDetailOutput = z.infer<typeof objectDetailOutputSchema>;

export const objectDetailInputSchema = z.object({
  objectId: z.string().min(1),
});
export type ObjectDetailInput = z.infer<typeof objectDetailInputSchema>;

export const entityAggregateScoreSchema = z.object({
  dimensionId: z.string().min(1),
  dimensionName: z.string().min(1),
  value: scoreValueSchema,
  explanation: z.string().min(1),
  metadata: z.unknown().optional(),
  updatedAt: isoDateTimeSchema,
});
export type EntityAggregateScore = z.infer<typeof entityAggregateScoreSchema>;

export const entityRelatedObjectSchema = z.object({
  objectId: z.string().min(1),
  title: z.string().min(1),
  publishedAt: isoDateTimeSchema.nullable(),
  topScore: scoreValueSchema.nullable(),
  role: z.string().min(1),
  position: z.number().int().nonnegative().nullable(),
});
export type EntityRelatedObject = z.infer<typeof entityRelatedObjectSchema>;

export const entityDetailInputSchema = z.object({
  entityId: z.string().min(1),
});
export type EntityDetailInput = z.infer<typeof entityDetailInputSchema>;

export const entityDetailOutputSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  externalId: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  scores: z.array(entityAggregateScoreSchema),
  relatedObjects: z.array(entityRelatedObjectSchema),
});
export type EntityDetailOutput = z.infer<typeof entityDetailOutputSchema>;

export const pipelineSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type PipelineSummary = z.infer<typeof pipelineSummarySchema>;

export const pipelineStageSchema = z.object({
  id: z.string().min(1),
  pipelineId: z.string().min(1),
  name: z.string().min(1),
  position: z.number().int().nonnegative(),
});
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const boardCardObjectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  publishedAt: isoDateTimeSchema.nullable(),
  topScore: scoreValueSchema.nullable(),
});
export type BoardCardObject = z.infer<typeof boardCardObjectSchema>;

export const pipelineBoardCardSchema = z.object({
  id: z.string().min(1),
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  objectId: z.string().min(1),
  position: z.number().int().nonnegative(),
  object: boardCardObjectSchema,
});
export type PipelineBoardCard = z.infer<typeof pipelineBoardCardSchema>;

export const pipelineBoardColumnSchema = pipelineStageSchema.extend({
  cards: z.array(pipelineBoardCardSchema),
});
export type PipelineBoardColumn = z.infer<typeof pipelineBoardColumnSchema>;

export const pipelineBoardSchema = z.object({
  pipeline: pipelineSummarySchema,
  stages: z.array(pipelineBoardColumnSchema),
});
export type PipelineBoard = z.infer<typeof pipelineBoardSchema>;

export const pipelinesListInputSchema = z.object({});
export type PipelinesListInput = z.infer<typeof pipelinesListInputSchema>;

export const pipelineCreateInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().trim().min(1).nullable().optional(),
  stageNames: z.array(z.string().trim().min(1)).min(1).max(10).optional(),
});
export type PipelineCreateInput = z.infer<typeof pipelineCreateInputSchema>;

const pipelineStagePatchSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
});

export const pipelineUpdateInputSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).optional(),
    description: z.string().trim().min(1).nullable().optional(),
    stages: z.array(pipelineStagePatchSchema).min(1).max(20).optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.description !== undefined ||
      value.stages !== undefined,
    {
      message: 'At least one field must be provided for update.',
      path: ['id'],
    }
  );
export type PipelineUpdateInput = z.infer<typeof pipelineUpdateInputSchema>;

export const pipelineDeleteInputSchema = z.object({
  id: z.string().min(1),
});
export type PipelineDeleteInput = z.infer<typeof pipelineDeleteInputSchema>;

export const pipelineDeleteOutputSchema = z.object({
  id: z.string().min(1),
  status: z.literal('deleted'),
});
export type PipelineDeleteOutput = z.infer<typeof pipelineDeleteOutputSchema>;

export const pipelineGetBoardInputSchema = z.object({
  pipelineId: z.string().min(1).optional(),
});
export type PipelineGetBoardInput = z.infer<typeof pipelineGetBoardInputSchema>;

export const pipelineAddCardInputSchema = z.object({
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  objectId: z.string().min(1),
  position: z.number().int().nonnegative().optional(),
});
export type PipelineAddCardInput = z.infer<typeof pipelineAddCardInputSchema>;

export const pipelineMoveCardInputSchema = z.object({
  pipelineId: z.string().min(1),
  cardId: z.string().min(1),
  toStageId: z.string().min(1),
  toPosition: z.number().int().nonnegative(),
});
export type PipelineMoveCardInput = z.infer<typeof pipelineMoveCardInputSchema>;

export const pipelineRemoveCardInputSchema = z.object({
  pipelineId: z.string().min(1),
  cardId: z.string().min(1),
});
export type PipelineRemoveCardInput = z.infer<typeof pipelineRemoveCardInputSchema>;
