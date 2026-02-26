import { describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '@paperscraper/shared';
import { runScoreObject } from './score-object';

function createGraphQueue() {
  return {
    getJobCounts: vi.fn(async () => ({
      waiting: 0,
      active: 0,
      delayed: 0,
      failed: 0,
    })),
    getJob: vi.fn(async () => null),
    add: vi.fn(async () => ({ id: 'job_1' })),
  };
}

function createBasePrisma(encryptedKey: string) {
  return {
    researchObject: {
      findUnique: vi.fn(async () => ({
        id: 'obj_1',
        title: 'Title',
        abstract: 'Abstract',
      })),
    },
    dimension: {
      findUnique: vi.fn(async () => ({
        id: 'dim_1',
        prompt: 'Score novelty.',
        provider: 'openai',
        model: 'gpt-4o-mini',
        isActive: true,
      })),
    },
    objectScore: {
      findUnique: vi.fn(async () => null),
      upsert: vi.fn(async () => ({ id: 'obj_score_1' })),
    },
    apiKey: {
      findUnique: vi.fn(async () => ({
        encryptedKey,
        revokedAt: null,
      })),
    },
    objectEntity: {
      findMany: vi.fn(async () => [{ entityId: 'ent_1' }]),
    },
  };
}

describe('score object', () => {
  it('fails deterministically when SECRETS_MASTER_KEY is missing', async () => {
    const graphQueue = createGraphQueue();
    const encryptedKey = 'enc:v1:invalid';
    const prisma = createBasePrisma(encryptedKey);
    const openAiScorer = { scoreObject: vi.fn(async () => ({ value: 50, explanation: 'ok' })) };
    const anthropicScorer = { scoreObject: vi.fn(async () => ({ value: 50, explanation: 'ok' })) };
    const log = vi.fn();

    await runScoreObject(
      {
        prisma: prisma as never,
        graphQueue: graphQueue as never,
        openAiScorer,
        anthropicScorer,
        secretsMasterKey: undefined,
        log,
      },
      { objectId: 'obj_1', dimensionId: 'dim_1', source: 'openalex' },
      1
    );

    expect(openAiScorer.scoreObject).not.toHaveBeenCalled();
    expect(prisma.objectScore.upsert).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'failed',
        reason: 'SECRETS_MASTER_KEY missing; scoring disabled.',
      })
    );
  });

  it('persists score and enqueues fold jobs for linked entities', async () => {
    const key = Buffer.alloc(32, 7);
    const encryptedKey = encryptSecret('sk-live-openai', key);
    const graphQueue = createGraphQueue();
    const prisma = createBasePrisma(encryptedKey);
    const openAiScorer = {
      scoreObject: vi.fn(async () => ({
        value: 77,
        explanation: 'Consistent and relevant',
        metadata: { tokens: 321 },
      })),
    };
    const anthropicScorer = { scoreObject: vi.fn(async () => ({ value: 50, explanation: 'ok' })) };

    await runScoreObject(
      {
        prisma: prisma as never,
        graphQueue: graphQueue as never,
        openAiScorer,
        anthropicScorer,
        secretsMasterKey: key.toString('base64'),
        log: () => undefined,
      },
      { objectId: 'obj_1', dimensionId: 'dim_1', source: 'openalex' },
      1
    );

    expect(openAiScorer.scoreObject).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'sk-live-openai', model: 'gpt-4o-mini' })
    );
    expect(prisma.objectScore.upsert).toHaveBeenCalledTimes(1);
    expect(graphQueue.add).toHaveBeenCalledTimes(1);
  });
});
