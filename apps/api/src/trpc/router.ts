import { initTRPC } from '@trpc/server';
import {
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
      .query(async ({ ctx, input }) => ctx.streamsEngine.list(input ?? {})),
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
});

export type AppRouter = typeof appRouter;
