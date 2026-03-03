import { initTRPC } from '@trpc/server';
import {
  apiKeyRevokeInputSchema,
  apiKeyUpsertInputSchema,
  dimensionCreateInputSchema,
  dimensionDeleteInputSchema,
  dimensionsListInputSchema,
  entityDetailInputSchema,
  objectDetailInputSchema,
  objectsFeedInputSchema,
  pipelineAddCardInputSchema,
  pipelineAddCardsBatchInputSchema,
  pipelineAddCardsBatchOutputSchema,
  pipelineCreateInputSchema,
  pipelineDeleteInputSchema,
  pipelineGetBoardInputSchema,
  pipelineMoveCardInputSchema,
  pipelineRemoveCardsBatchInputSchema,
  pipelineRemoveCardsBatchOutputSchema,
  pipelineRemoveCardInputSchema,
  pipelinesListInputSchema,
  pipelineUpdateInputSchema,
  dimensionUpdateInputSchema,
  scoreBackfillDimensionInputSchema,
  streamCreateInputSchema,
  streamDeleteInputSchema,
  streamRunsInputSchema,
  streamsListInputSchema,
  streamTriggerInputSchema,
  streamUpdateInputSchema,
  workspaceFeedPreferencesGetInputSchema,
  workspaceFeedPreferencesUpsertInputSchema,
  workspaceSavedViewCreateInputSchema,
  workspaceSavedViewDeleteInputSchema,
  workspaceSavedViewDeleteOutputSchema,
  workspaceSavedViewUpdateInputSchema,
  workspaceSavedViewsListInputSchema,
  objectNoteGetInputSchema,
  objectNoteUpsertInputSchema,
  objectNoteUpsertResultSchema,
} from '@paperscraper/shared';
import type { TrpcContext } from './context';

const t = initTRPC.context<TrpcContext>().create();

export const appRouter = t.router({
  system: t.router({
    health: t.procedure.query(async ({ ctx }) => ctx.systemEngine.getHealthSnapshot()),
  }),
  streams: t.router({
    list: t.procedure
      .input(streamsListInputSchema.optional())
      .query(async ({ ctx, input }) =>
        ctx.streamsEngine.list(input ?? { includeInactive: false })
      ),
    create: t.procedure
      .input(streamCreateInputSchema)
      .mutation(async ({ ctx, input }) => ctx.streamsEngine.create(input)),
    update: t.procedure
      .input(streamUpdateInputSchema)
      .mutation(async ({ ctx, input }) => ctx.streamsEngine.update(input)),
    delete: t.procedure
      .input(streamDeleteInputSchema)
      .mutation(async ({ ctx, input }) => ctx.streamsEngine.delete(input)),
    trigger: t.procedure
      .input(streamTriggerInputSchema)
      .mutation(async ({ ctx, input }) => ctx.streamsEngine.trigger(input)),
    runs: t.procedure
      .input(streamRunsInputSchema)
      .query(async ({ ctx, input }) => ctx.streamsEngine.runs(input)),
  }),
  dimensions: t.router({
    list: t.procedure
      .input(dimensionsListInputSchema.optional())
      .query(async ({ ctx, input }) =>
        ctx.scoringEngine.list(input ?? { includeInactive: false })
      ),
    create: t.procedure
      .input(dimensionCreateInputSchema)
      .mutation(async ({ ctx, input }) => ctx.scoringEngine.create(input)),
    update: t.procedure
      .input(dimensionUpdateInputSchema)
      .mutation(async ({ ctx, input }) => ctx.scoringEngine.update(input)),
    delete: t.procedure
      .input(dimensionDeleteInputSchema)
      .mutation(async ({ ctx, input }) => ctx.scoringEngine.delete(input)),
  }),
  scores: t.router({
    backfillDimension: t.procedure
      .input(scoreBackfillDimensionInputSchema)
      .mutation(async ({ ctx, input }) => ctx.scoringEngine.backfillDimension(input)),
  }),
  apiKeys: t.router({
    upsert: t.procedure
      .input(apiKeyUpsertInputSchema)
      .mutation(async ({ ctx, input }) => ctx.apiKeysEngine.upsert(input)),
    revoke: t.procedure
      .input(apiKeyRevokeInputSchema)
      .mutation(async ({ ctx, input }) => ctx.apiKeysEngine.revoke(input)),
    listProviders: t.procedure.query(async ({ ctx }) => ctx.apiKeysEngine.listProviders()),
  }),
  objects: t.router({
    feed: t.procedure
      .input(objectsFeedInputSchema.optional())
      .query(async ({ ctx, input }) =>
        ctx.queryEngine.feed(input ?? { sortBy: 'topScore', limit: 20 })
      ),
    detail: t.procedure
      .input(objectDetailInputSchema)
      .query(async ({ ctx, input }) => ctx.queryEngine.objectDetail(input)),
  }),
  entities: t.router({
    detail: t.procedure
      .input(entityDetailInputSchema)
      .query(async ({ ctx, input }) => ctx.queryEngine.entityDetail(input)),
  }),
  pipelines: t.router({
    list: t.procedure
      .input(pipelinesListInputSchema.optional())
      .query(async ({ ctx, input }) => ctx.pipelineEngine.list(input ?? {})),
    create: t.procedure
      .input(pipelineCreateInputSchema)
      .mutation(async ({ ctx, input }) => ctx.pipelineEngine.create(input)),
    update: t.procedure
      .input(pipelineUpdateInputSchema)
      .mutation(async ({ ctx, input }) => ctx.pipelineEngine.update(input)),
    delete: t.procedure
      .input(pipelineDeleteInputSchema)
      .mutation(async ({ ctx, input }) => ctx.pipelineEngine.delete(input)),
    getBoard: t.procedure
      .input(pipelineGetBoardInputSchema.optional())
      .query(async ({ ctx, input }) => ctx.pipelineEngine.getBoard(input ?? {})),
    addCard: t.procedure
      .input(pipelineAddCardInputSchema)
      .mutation(async ({ ctx, input }) => ctx.pipelineEngine.addCard(input)),
    addCardsBatch: t.procedure
      .input(pipelineAddCardsBatchInputSchema)
      .output(pipelineAddCardsBatchOutputSchema)
      .mutation(async ({ ctx, input }) => ctx.pipelineEngine.addCardsBatch(input)),
    moveCard: t.procedure
      .input(pipelineMoveCardInputSchema)
      .mutation(async ({ ctx, input }) => ctx.pipelineEngine.moveCard(input)),
    removeCard: t.procedure
      .input(pipelineRemoveCardInputSchema)
      .mutation(async ({ ctx, input }) => ctx.pipelineEngine.removeCard(input)),
    removeCardsBatch: t.procedure
      .input(pipelineRemoveCardsBatchInputSchema)
      .output(pipelineRemoveCardsBatchOutputSchema)
      .mutation(async ({ ctx, input }) => ctx.pipelineEngine.removeCardsBatch(input)),
  }),
  workspace: t.router({
    listSavedViews: t.procedure
      .input(workspaceSavedViewsListInputSchema.optional())
      .query(async ({ ctx, input }) => ctx.workspaceEngine.listSavedViews(input ?? {})),
    createSavedView: t.procedure
      .input(workspaceSavedViewCreateInputSchema)
      .mutation(async ({ ctx, input }) => ctx.workspaceEngine.createSavedView(input)),
    updateSavedView: t.procedure
      .input(workspaceSavedViewUpdateInputSchema)
      .mutation(async ({ ctx, input }) => ctx.workspaceEngine.updateSavedView(input)),
    deleteSavedView: t.procedure
      .input(workspaceSavedViewDeleteInputSchema)
      .output(workspaceSavedViewDeleteOutputSchema)
      .mutation(async ({ ctx, input }) => ctx.workspaceEngine.deleteSavedView(input)),
    getFeedPreferences: t.procedure
      .input(workspaceFeedPreferencesGetInputSchema.optional())
      .query(async ({ ctx, input }) => ctx.workspaceEngine.getFeedPreferences(input ?? {})),
    upsertFeedPreferences: t.procedure
      .input(workspaceFeedPreferencesUpsertInputSchema)
      .mutation(async ({ ctx, input }) => ctx.workspaceEngine.upsertFeedPreferences(input)),
    getObjectNote: t.procedure
      .input(objectNoteGetInputSchema)
      .query(async ({ ctx, input }) => ctx.workspaceEngine.getObjectNote(input)),
    upsertObjectNote: t.procedure
      .input(objectNoteUpsertInputSchema)
      .output(objectNoteUpsertResultSchema)
      .mutation(async ({ ctx, input }) => ctx.workspaceEngine.upsertObjectNote(input)),
  }),
});

export type AppRouter = typeof appRouter;
