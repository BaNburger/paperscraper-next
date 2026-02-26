import type { PrismaClient } from '@paperscraper/db';
import type { Queue } from 'bullmq';
import { ingestStreamJobPayloadSchema } from '@paperscraper/shared';
import { emitObjectCreatedEvents } from './stream-events';
import {
  normalizeOpenAlexWorks,
  type NormalizedResearchObject,
} from './openalex-normalizer';
import { readQueueDepth } from '../lib/queue-depth';
import type { OpenAlexFetchResult, OpenAlexRetryLog } from './openalex-provider';
import { persistResearchObjects } from './stream-persistence';
import { logIngestionRunEvent } from './stream-run-log';

interface StreamRunnerDeps {
  prisma: PrismaClient;
  ingestQueue: Queue;
  graphQueue: Queue;
  fetchWorks: (
    query: string,
    maxObjects: number,
    onRetry?: (event: OpenAlexRetryLog) => void
  ) => Promise<OpenAlexFetchResult>;
  log?: (entry: Record<string, unknown>) => void;
}

const streamSelect = {
  id: true,
  query: true,
  maxObjects: true,
  source: true,
} as const;

function asReason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown ingestion error';
}

async function markRunFailed(
  prisma: PrismaClient,
  runId: string,
  failureReason: string
): Promise<void> {
  await prisma.streamRun.update({
    where: { id: runId },
    data: {
      status: 'failed',
      failureReason,
      finishedAt: new Date(),
    },
    select: { id: true },
  });
}

function summarizeNormalization(
  fetched: OpenAlexFetchResult
): { normalized: NormalizedResearchObject[]; failedCount: number } {
  const normalized = normalizeOpenAlexWorks(fetched.works);
  return {
    normalized: normalized.normalized,
    failedCount: fetched.failedCount + normalized.failedCount,
  };
}

async function runSingleQueuedRun(
  deps: StreamRunnerDeps,
  streamId: string,
  runId: string
): Promise<void> {
  const startedAt = Date.now();
  const stream = await deps.prisma.stream.findUnique({
    where: { id: streamId },
    select: streamSelect,
  });

  if (!stream) {
    await markRunFailed(deps.prisma, runId, 'Stream not found.');
    return;
  }
  if (stream.source !== 'openalex') {
    await markRunFailed(deps.prisma, runId, `Unsupported stream source: ${stream.source}`);
    return;
  }

  const boundaryStart = {
    ingest: await readQueueDepth(deps.ingestQueue),
    graph: await readQueueDepth(deps.graphQueue),
  };
  logIngestionRunEvent(deps.log, {
    streamId,
    runId,
    state: 'running',
    attempt: 1,
    durationMs: 0,
    queueDepth: boundaryStart,
  });

  try {
    const fetched = await deps.fetchWorks(stream.query, stream.maxObjects, (event) => {
      logIngestionRunEvent(deps.log, {
        streamId,
        runId,
        state: 'degraded',
        attempt: event.attempt,
        durationMs: Date.now() - startedAt,
        reason: event.reason,
      });
    });
    const normalized = summarizeNormalization(fetched);
    const persisted = await persistResearchObjects(deps.prisma, normalized.normalized);

    await emitObjectCreatedEvents(
      deps.graphQueue,
      persisted.insertedIds,
      stream.id,
      runId
    );

    const failedCount = normalized.failedCount + persisted.failedCount;
    await deps.prisma.streamRun.update({
      where: { id: runId },
      data: {
        status: 'succeeded',
        finishedAt: new Date(),
        failureReason: null,
        processedCount: fetched.processedCount,
        insertedCount: persisted.insertedCount,
        updatedCount: persisted.updatedCount,
        failedCount,
      },
      select: { id: true },
    });

    const boundaryEnd = {
      ingest: await readQueueDepth(deps.ingestQueue),
      graph: await readQueueDepth(deps.graphQueue),
    };
    logIngestionRunEvent(deps.log, {
      streamId,
      runId,
      state: 'ready',
      attempt: 1,
      durationMs: Date.now() - startedAt,
      queueDepth: boundaryEnd,
      processedCount: fetched.processedCount,
      insertedCount: persisted.insertedCount,
      updatedCount: persisted.updatedCount,
      failedCount,
    });
  } catch (error) {
    const reason = asReason(error);
    await markRunFailed(deps.prisma, runId, reason);
    const boundaryEnd = {
      ingest: await readQueueDepth(deps.ingestQueue),
      graph: await readQueueDepth(deps.graphQueue),
    };
    logIngestionRunEvent(deps.log, {
      streamId,
      runId,
      state: 'failed',
      attempt: 1,
      durationMs: Date.now() - startedAt,
      reason,
      queueDepth: boundaryEnd,
    });
  }
}

async function claimNextQueuedRun(
  prisma: PrismaClient,
  streamId: string
): Promise<string | null> {
  const queuedRun = await prisma.streamRun.findFirst({
    where: {
      streamId,
      status: 'queued',
    },
    orderBy: {
      startedAt: 'asc',
    },
    select: {
      id: true,
    },
  });
  if (!queuedRun) {
    return null;
  }

  const claim = await prisma.streamRun.updateMany({
    where: {
      id: queuedRun.id,
      status: 'queued',
    },
    data: {
      status: 'running',
      startedAt: new Date(),
      finishedAt: null,
      failureReason: null,
    },
  });

  return claim.count > 0 ? queuedRun.id : '';
}

export async function runIngestStreamRunner(
  deps: StreamRunnerDeps,
  payloadInput: unknown
): Promise<void> {
  const payload = ingestStreamJobPayloadSchema.parse(payloadInput);

  while (true) {
    const claimedRunId = await claimNextQueuedRun(deps.prisma, payload.streamId);
    if (claimedRunId === null) {
      break;
    }
    if (!claimedRunId) {
      continue;
    }
    await runSingleQueuedRun(deps, payload.streamId, claimedRunId);
  }
}
