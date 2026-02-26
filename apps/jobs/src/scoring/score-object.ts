import type { Prisma, PrismaClient } from '@paperscraper/db';
import type { Queue } from 'bullmq';
import { z } from 'zod';
import {
  SCORE_FOLD_ENTITY_JOB_NAME,
  buildScoreFoldEntityJobId,
  decryptSecret,
  loadOptionalMasterKey,
  scoreFoldEntityJobPayloadSchema,
  scoreObjectJobPayloadSchema,
  scoringRunLogSchema,
  type ScoreOutput,
} from '@paperscraper/shared';
import { createMemoizedQueueDepthReader } from '../lib/queue-depth';
import { emitValidatedLog } from '../lib/logging';
import { addJobIfMissing, createStandardJobOptions } from '../lib/queue-utils';
import {
  LlmProviderPermanentError,
  LlmProviderTransientError,
} from './llm-provider';

type Scorer = {
  scoreObject: (input: {
    apiKey: string;
    model: string;
    dimensionPrompt: string;
    title: string;
    abstract: string | null;
  }) => Promise<ScoreOutput>;
};

type ScoreObjectDeps = {
  prisma: PrismaClient;
  graphQueue: Queue;
  openAiScorer: Scorer;
  anthropicScorer: Scorer;
  secretsMasterKey: string | undefined;
  log?: (entry: Record<string, unknown>) => void;
};

type LoadedScoreContext = {
  object: {
    id: string;
    title: string;
    abstract: string | null;
  };
  dimension: {
    id: string;
    prompt: string;
    provider: 'openai' | 'anthropic';
    model: string;
    isActive: boolean;
  };
};

function emitLog(
  log: ((entry: Record<string, unknown>) => void) | undefined,
  payload: Omit<z.infer<typeof scoringRunLogSchema>, 'component'>
): void {
  emitValidatedLog(
    scoringRunLogSchema,
    {
      component: 'jobs-worker',
      ...payload,
    },
    log
  );
}

function scorerForProvider(
  deps: ScoreObjectDeps,
  provider: 'openai' | 'anthropic'
): Scorer {
  return provider === 'openai' ? deps.openAiScorer : deps.anthropicScorer;
}

function normalizeJsonMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function loadScoreContext(
  deps: ScoreObjectDeps,
  payload: z.infer<typeof scoreObjectJobPayloadSchema>
): Promise<LoadedScoreContext | null> {
  const [object, dimension] = await Promise.all([
    deps.prisma.researchObject.findUnique({
      where: { id: payload.objectId },
      select: { id: true, title: true, abstract: true },
    }),
    deps.prisma.dimension.findUnique({
      where: { id: payload.dimensionId },
      select: {
        id: true,
        prompt: true,
        provider: true,
        model: true,
        isActive: true,
      },
    }),
  ]);
  if (!object || !dimension) {
    return null;
  }
  return { object, dimension };
}

async function enqueueFoldJobs(
  deps: ScoreObjectDeps,
  dimensionId: string,
  objectId: string
): Promise<void> {
  const links = await deps.prisma.objectEntity.findMany({
    where: { objectId },
    select: { entityId: true },
  });
  const entityIds = Array.from(new Set(links.map((link) => link.entityId)));
  for (const entityId of entityIds) {
    const payload = scoreFoldEntityJobPayloadSchema.parse({ dimensionId, entityId });
    const jobId = buildScoreFoldEntityJobId(payload.dimensionId, payload.entityId);
    await addJobIfMissing(
      deps.graphQueue,
      SCORE_FOLD_ENTITY_JOB_NAME,
      payload,
      createStandardJobOptions(jobId, 3)
    );
  }
}

async function persistScore(
  deps: ScoreObjectDeps,
  payload: z.infer<typeof scoreObjectJobPayloadSchema>,
  output: ScoreOutput
): Promise<void> {
  await deps.prisma.objectScore.upsert({
    where: {
      dimensionId_objectId: {
        dimensionId: payload.dimensionId,
        objectId: payload.objectId,
      },
    },
    create: {
      dimensionId: payload.dimensionId,
      objectId: payload.objectId,
      value: output.value,
      explanation: output.explanation,
      metadata: normalizeJsonMetadata(output.metadata),
    },
    update: {
      value: output.value,
      explanation: output.explanation,
      metadata: normalizeJsonMetadata(output.metadata),
    },
    select: { id: true },
  });
}

export async function runScoreObject(
  deps: ScoreObjectDeps,
  payloadInput: unknown,
  attempt = 1
): Promise<void> {
  const payload = scoreObjectJobPayloadSchema.parse(payloadInput);
  const startedAt = Date.now();
  const getDepth = createMemoizedQueueDepthReader(deps.graphQueue);
  const queueDepth = async () => ({ graph: await getDepth() });

  const loaded = await loadScoreContext(deps, payload);
  if (!loaded || !loaded.dimension.isActive) {
    emitLog(deps.log, {
      state: 'degraded',
      objectId: payload.objectId,
      dimensionId: payload.dimensionId,
      attempt,
      durationMs: Date.now() - startedAt,
      reason: 'Object or active dimension not available for scoring.',
      queueDepth: await queueDepth(),
    });
    return;
  }

  const existing = await deps.prisma.objectScore.findUnique({
    where: {
      dimensionId_objectId: {
        dimensionId: payload.dimensionId,
        objectId: payload.objectId,
      },
    },
    select: { id: true },
  });
  if (existing) {
    await enqueueFoldJobs(deps, payload.dimensionId, payload.objectId);
    return;
  }

  const apiKey = await deps.prisma.apiKey.findUnique({
    where: { provider: loaded.dimension.provider },
    select: { encryptedKey: true, revokedAt: true },
  });
  if (!apiKey || apiKey.revokedAt) {
    emitLog(deps.log, {
      state: 'failed',
      objectId: payload.objectId,
      dimensionId: payload.dimensionId,
      attempt,
      durationMs: Date.now() - startedAt,
      reason: `No active API key for provider ${loaded.dimension.provider}.`,
      queueDepth: await queueDepth(),
    });
    return;
  }

  const masterKey = loadOptionalMasterKey(deps.secretsMasterKey);
  if (!masterKey) {
    emitLog(deps.log, {
      state: 'failed',
      objectId: payload.objectId,
      dimensionId: payload.dimensionId,
      attempt,
      durationMs: Date.now() - startedAt,
      reason: 'SECRETS_MASTER_KEY missing; scoring disabled.',
      queueDepth: await queueDepth(),
    });
    return;
  }

  let plaintextKey = '';
  try {
    plaintextKey = decryptSecret(apiKey.encryptedKey, masterKey);
  } catch {
    emitLog(deps.log, {
      state: 'failed',
      objectId: payload.objectId,
      dimensionId: payload.dimensionId,
      attempt,
      durationMs: Date.now() - startedAt,
      reason: `Failed to decrypt ${loaded.dimension.provider} API key.`,
      queueDepth: await queueDepth(),
    });
    return;
  }

  try {
    const scorer = scorerForProvider(deps, loaded.dimension.provider);
    const output = await scorer.scoreObject({
      apiKey: plaintextKey,
      model: loaded.dimension.model,
      dimensionPrompt: loaded.dimension.prompt,
      title: loaded.object.title,
      abstract: loaded.object.abstract,
    });

    await persistScore(deps, payload, output);
    await enqueueFoldJobs(deps, payload.dimensionId, payload.objectId);
    emitLog(deps.log, {
      state: 'ready',
      objectId: payload.objectId,
      dimensionId: payload.dimensionId,
      attempt,
      durationMs: Date.now() - startedAt,
      scoreValue: output.value,
      queueDepth: await queueDepth(),
    });
  } catch (error) {
    if (error instanceof LlmProviderTransientError) {
      emitLog(deps.log, {
        state: 'degraded',
        objectId: payload.objectId,
        dimensionId: payload.dimensionId,
        attempt,
        durationMs: Date.now() - startedAt,
        reason: error.message,
        queueDepth: await queueDepth(),
      });
      throw error;
    }
    const reason =
      error instanceof LlmProviderPermanentError || error instanceof Error
        ? error.message
        : 'Unknown scoring failure.';
    emitLog(deps.log, {
      state: 'failed',
      objectId: payload.objectId,
      dimensionId: payload.dimensionId,
      attempt,
      durationMs: Date.now() - startedAt,
      reason,
      queueDepth: await queueDepth(),
    });
  }
}
