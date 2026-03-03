import { z } from 'zod';
import { feedSortSchema } from './contracts-s1_4';

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const feedDensitySchema = z.enum(['comfortable', 'compact']);
export type FeedDensity = z.infer<typeof feedDensitySchema>;

export const feedColumnSchema = z.enum([
  'title',
  'topScore',
  'publishedAt',
  'entities',
  'stage',
]);
export type FeedColumn = z.infer<typeof feedColumnSchema>;

export const feedViewFiltersSchema = z.object({
  query: z.string().trim().min(1).optional(),
  streamId: z.string().min(1).optional(),
  pipelineId: z.string().min(1).optional(),
  stageId: z.string().min(1).optional(),
  sortBy: feedSortSchema.optional().default('topScore'),
});
export type FeedViewFilters = z.infer<typeof feedViewFiltersSchema>;

export const feedViewLayoutSchema = z.object({
  density: feedDensitySchema.optional().default('comfortable'),
  visibleColumns: z.array(feedColumnSchema).min(1).max(8),
  sidePaneWidth: z.number().int().min(280).max(640),
});
export type FeedViewLayout = z.infer<typeof feedViewLayoutSchema>;

export const savedViewDefinitionSchema = z.object({
  filters: feedViewFiltersSchema,
  layout: feedViewLayoutSchema,
});
export type SavedViewDefinition = z.infer<typeof savedViewDefinitionSchema>;

export const feedSavedViewSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  definition: savedViewDefinitionSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type FeedSavedView = z.infer<typeof feedSavedViewSchema>;

export const workspaceSavedViewsListInputSchema = z.object({});
export type WorkspaceSavedViewsListInput = z.infer<typeof workspaceSavedViewsListInputSchema>;

export const workspaceSavedViewCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  definition: savedViewDefinitionSchema,
});
export type WorkspaceSavedViewCreateInput = z.infer<typeof workspaceSavedViewCreateInputSchema>;

export const workspaceSavedViewUpdateInputSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(80).optional(),
    definition: savedViewDefinitionSchema.optional(),
  })
  .refine((value) => value.name !== undefined || value.definition !== undefined, {
    message: 'At least one field must be provided for update.',
    path: ['id'],
  });
export type WorkspaceSavedViewUpdateInput = z.infer<typeof workspaceSavedViewUpdateInputSchema>;

export const workspaceSavedViewDeleteInputSchema = z.object({
  id: z.string().min(1),
});
export type WorkspaceSavedViewDeleteInput = z.infer<typeof workspaceSavedViewDeleteInputSchema>;

export const workspaceSavedViewDeleteOutputSchema = z.object({
  id: z.string().min(1),
  status: z.literal('deleted'),
});
export type WorkspaceSavedViewDeleteOutput = z.infer<typeof workspaceSavedViewDeleteOutputSchema>;

export const workspaceFeedPreferencesSchema = z.object({
  defaultDensity: feedDensitySchema.default('comfortable'),
  defaultVisibleColumns: z.array(feedColumnSchema).min(1).max(8),
  feedSidePaneWidth: z.number().int().min(280).max(640),
  pipelineSidePaneWidth: z.number().int().min(280).max(640),
  lastSavedViewId: z.string().min(1).nullable(),
});
export type WorkspaceFeedPreferences = z.infer<typeof workspaceFeedPreferencesSchema>;

export const workspaceFeedPreferencesGetInputSchema = z.object({});
export type WorkspaceFeedPreferencesGetInput = z.infer<typeof workspaceFeedPreferencesGetInputSchema>;

export const workspaceFeedPreferencesUpsertInputSchema = workspaceFeedPreferencesSchema;
export type WorkspaceFeedPreferencesUpsertInput = z.infer<
  typeof workspaceFeedPreferencesUpsertInputSchema
>;

export const objectNoteDocumentSchema = z.array(z.record(z.string(), z.unknown()));
export type ObjectNoteDocument = z.infer<typeof objectNoteDocumentSchema>;

export const objectNoteSchema = z.object({
  objectId: z.string().min(1),
  document: objectNoteDocumentSchema,
  revision: z.number().int().nonnegative(),
  updatedAt: isoDateTimeSchema,
});
export type ObjectNote = z.infer<typeof objectNoteSchema>;

export const objectNoteGetInputSchema = z.object({
  objectId: z.string().min(1),
});
export type ObjectNoteGetInput = z.infer<typeof objectNoteGetInputSchema>;

export const objectNoteUpsertInputSchema = z.object({
  objectId: z.string().min(1),
  document: objectNoteDocumentSchema,
  expectedRevision: z.number().int().nonnegative().nullable(),
});
export type ObjectNoteUpsertInput = z.infer<typeof objectNoteUpsertInputSchema>;

export const objectNoteUpsertResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('updated'),
    note: objectNoteSchema,
  }),
  z.object({
    status: z.literal('conflict'),
    latest: objectNoteSchema,
  }),
]);
export type ObjectNoteUpsertResult = z.infer<typeof objectNoteUpsertResultSchema>;

export const pipelineAddCardsBatchInputSchema = z.object({
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  objectIds: z.array(z.string().min(1)).min(1).max(200),
});
export type PipelineAddCardsBatchInput = z.infer<typeof pipelineAddCardsBatchInputSchema>;

export const pipelineAddCardsBatchOutputSchema = z.object({
  pipelineId: z.string().min(1),
  stageId: z.string().min(1),
  added: z.number().int().nonnegative(),
  skippedAlreadyPresent: z.number().int().nonnegative(),
  addedCardIds: z.array(z.string().min(1)),
});
export type PipelineAddCardsBatchOutput = z.infer<typeof pipelineAddCardsBatchOutputSchema>;

export const pipelineRemoveCardsBatchInputSchema = z.object({
  pipelineId: z.string().min(1),
  cardIds: z.array(z.string().min(1)).min(1).max(200),
});
export type PipelineRemoveCardsBatchInput = z.infer<typeof pipelineRemoveCardsBatchInputSchema>;

export const pipelineRemoveCardsBatchOutputSchema = z.object({
  pipelineId: z.string().min(1),
  removed: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
});
export type PipelineRemoveCardsBatchOutput = z.infer<typeof pipelineRemoveCardsBatchOutputSchema>;
