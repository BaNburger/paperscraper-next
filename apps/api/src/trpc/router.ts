import { initTRPC } from '@trpc/server';
import {
  apiKeyRevokeInputSchema,
  apiKeyUpsertInputSchema,
  dimensionCreateInputSchema,
  dimensionDeleteInputSchema,
  dimensionsListInputSchema,
  dimensionUpdateInputSchema,
  scoreBackfillDimensionInputSchema,
  streamCreateInputSchema,
  streamDeleteInputSchema,
  streamRunsInputSchema,
  streamsListInputSchema,
  streamTriggerInputSchema,
  streamUpdateInputSchema,
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
});

export type AppRouter = typeof appRouter;
