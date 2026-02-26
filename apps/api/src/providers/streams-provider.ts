import type { PrismaClient } from '@paperscraper/db';
import type { Queue } from 'bullmq';
import { enqueueStreamRunner } from './stream-queue-provider';

interface StreamRow {
  id: string;
  name: string;
  query: string;
  source: 'openalex';
  maxObjects: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface StreamRunRow {
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
}

type StreamCreateInput = {
  name: string;
  query: string;
  maxObjects?: number;
};

type StreamUpdatePatch = {
  name?: string;
  query?: string;
  maxObjects?: number;
  isActive?: boolean;
};

export interface StreamsProviderDeps {
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

const streamSelect = {
  id: true,
  name: true,
  query: true,
  source: true,
  maxObjects: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const streamRunSelect = {
  id: true,
  streamId: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  processedCount: true,
  insertedCount: true,
  updatedCount: true,
  failedCount: true,
  failureReason: true,
} as const;

export function createStreamsProvider(
  prisma: PrismaClient,
  queue: Queue
): StreamsProviderDeps {
  return {
    listStreams: async (includeInactive) => {
      const where = includeInactive ? {} : { isActive: true };
      const streams = await prisma.stream.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: streamSelect,
      });
      return streams.map((row) => ({
        ...row,
        source: row.source,
      }));
    },

    createStream: async (input) => {
      const stream = await prisma.stream.create({
        data: {
          name: input.name,
          query: input.query,
          source: 'openalex',
          maxObjects: input.maxObjects ?? 100,
          isActive: true,
        },
        select: streamSelect,
      });
      return { ...stream, source: stream.source };
    },

    getStreamById: async (streamId) => {
      const stream = await prisma.stream.findUnique({
        where: { id: streamId },
        select: streamSelect,
      });
      return stream ? { ...stream, source: stream.source } : null;
    },

    countQueuedOrRunningRuns: async (streamId) => {
      return prisma.streamRun.count({
        where: {
          streamId,
          status: { in: ['queued', 'running'] },
        },
      });
    },

    updateStream: async (streamId, patch) => {
      const stream = await prisma.stream.update({
        where: { id: streamId },
        data: patch,
        select: streamSelect,
      });
      return { ...stream, source: stream.source };
    },

    createQueuedRun: async (streamId) => {
      return prisma.streamRun.create({
        data: {
          streamId,
          status: 'queued',
        },
        select: streamRunSelect,
      });
    },

    markRunFailed: async (runId, reason) => {
      await prisma.streamRun.update({
        where: { id: runId },
        data: {
          status: 'failed',
          failureReason: reason,
          finishedAt: new Date(),
        },
        select: { id: true },
      });
    },

    listRuns: async (streamId, limit) => {
      return prisma.streamRun.findMany({
        where: { streamId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: streamRunSelect,
      });
    },

    enqueueStreamRunner: async (streamId) => {
      await enqueueStreamRunner(queue, streamId);
    },
  };
}
