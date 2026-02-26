import {
  streamCreateInputSchema,
  streamDeleteInputSchema,
  streamRunsInputSchema,
  streamsListInputSchema,
  streamRunSchema,
  streamSchema,
  streamTriggerInputSchema,
  streamUpdateInputSchema,
  type StreamCreateInput,
  type StreamDeleteInput,
  type StreamRunsInput,
  type StreamsListInput,
  type StreamTriggerInput,
  type StreamUpdateInput,
} from '@paperscraper/shared';
import { TRPCError } from '@trpc/server';

type StreamRow = {
  id: string;
  name: string;
  query: string;
  source: 'openalex';
  maxObjects: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type StreamRunRow = {
  id: string;
  streamId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  startedAt: Date;
  finishedAt: Date | null;
  processedCount: number;
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  failureReason: string | null;
};

type StreamUpdatePatch = {
  name?: string;
  query?: string;
  maxObjects?: number;
  isActive?: boolean;
};

export interface StreamsEngineDeps {
  listStreams: (includeInactive: boolean) => Promise<StreamRow[]>;
  createStream: (input: StreamCreateInput) => Promise<StreamRow>;
  getStreamById: (streamId: string) => Promise<StreamRow | null>;
  countQueuedOrRunningRuns: (streamId: string) => Promise<number>;
  updateStream: (streamId: string, patch: StreamUpdatePatch) => Promise<StreamRow>;
  createQueuedRun: (streamId: string) => Promise<StreamRunRow>;
  markRunFailed: (runId: string, reason: string) => Promise<void>;
  listRuns: (streamId: string, limit: number) => Promise<StreamRunRow[]>;
  enqueueStreamRunner: (streamId: string) => Promise<void>;
}

function toStreamDto(row: StreamRow) {
  return streamSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function toRunDto(row: StreamRunRow) {
  return streamRunSchema.parse({
    ...row,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  });
}

function assertPatchPresent(input: StreamUpdateInput): void {
  if (
    input.name === undefined &&
    input.query === undefined &&
    input.maxObjects === undefined &&
    input.isActive === undefined
  ) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'At least one updatable field must be provided.',
    });
  }
}

function ensureActiveStream(stream: StreamRow | null): StreamRow {
  if (!stream) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Stream not found.' });
  }
  if (!stream.isActive) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Stream is inactive and cannot be triggered.' });
  }
  return stream;
}

export function createStreamsEngine(deps: StreamsEngineDeps) {
  return {
    async list(input: StreamsListInput) {
      const parsed = streamsListInputSchema.parse(input);
      const rows = await deps.listStreams(parsed.includeInactive);
      return rows.map(toStreamDto);
    },

    async create(input: StreamCreateInput) {
      const parsed = streamCreateInputSchema.parse(input);
      const created = await deps.createStream(parsed);
      return toStreamDto(created);
    },

    async update(input: StreamUpdateInput) {
      const parsed = streamUpdateInputSchema.parse(input);
      assertPatchPresent(parsed);

      const stream = await deps.getStreamById(parsed.id);
      if (!stream) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Stream not found.' });
      }

      const activeRunCount = await deps.countQueuedOrRunningRuns(parsed.id);
      if (activeRunCount > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Cannot update stream while runs are queued or running.',
        });
      }

      const updated = await deps.updateStream(parsed.id, {
        name: parsed.name,
        query: parsed.query,
        maxObjects: parsed.maxObjects,
        isActive: parsed.isActive,
      });
      return toStreamDto(updated);
    },

    async delete(input: StreamDeleteInput) {
      const parsed = streamDeleteInputSchema.parse(input);
      const stream = await deps.getStreamById(parsed.id);
      if (!stream) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Stream not found.' });
      }

      const updated = await deps.updateStream(parsed.id, { isActive: false });
      return toStreamDto(updated);
    },

    async trigger(input: StreamTriggerInput) {
      const parsed = streamTriggerInputSchema.parse(input);
      const stream = ensureActiveStream(await deps.getStreamById(parsed.id));
      const run = await deps.createQueuedRun(stream.id);

      try {
        await deps.enqueueStreamRunner(stream.id);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown enqueue failure';
        await deps.markRunFailed(run.id, reason);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to enqueue stream runner: ${reason}`,
        });
      }

      return toRunDto(run);
    },

    async runs(input: StreamRunsInput) {
      const parsed = streamRunsInputSchema.parse(input);
      const stream = await deps.getStreamById(parsed.streamId);
      if (!stream) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Stream not found.' });
      }

      const runs = await deps.listRuns(parsed.streamId, parsed.limit);
      return runs.map(toRunDto);
    },
  };
}

export type StreamsEngine = ReturnType<typeof createStreamsEngine>;
