import { describe, expect, it, vi } from 'vitest';
import { createApiKeysEngine } from './api-keys-engine';

function createEngine(masterKey: string | undefined) {
  const upsertApiKey = vi.fn(async (provider: 'openai' | 'anthropic', encryptedKey: string) => ({
    provider,
    encryptedKey,
    updatedAt: new Date('2026-02-26T00:00:00.000Z'),
    revokedAt: null,
  }));
  const revokeApiKey = vi.fn(async (provider: 'openai' | 'anthropic') => ({
    provider,
    encryptedKey: 'enc:v1:test',
    updatedAt: new Date('2026-02-26T00:00:00.000Z'),
    revokedAt: new Date('2026-02-26T01:00:00.000Z'),
  } as
    | {
        provider: 'openai' | 'anthropic';
        encryptedKey: string;
        updatedAt: Date;
        revokedAt: Date;
      }
    | null));
  const listApiKeys = vi.fn(async () => [
    {
      provider: 'openai' as const,
      encryptedKey: 'enc:v1:test',
      updatedAt: new Date('2026-02-26T00:00:00.000Z'),
      revokedAt: null,
    },
  ]);
  const engine = createApiKeysEngine(
    {
      upsertApiKey,
      revokeApiKey,
      listApiKeys,
    },
    { secretsMasterKey: masterKey }
  );
  return { engine, upsertApiKey, revokeApiKey, listApiKeys };
}

describe('api keys engine', () => {
  it('upserts encrypted key when master key is available', async () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const { engine, upsertApiKey } = createEngine(key);
    const state = await engine.upsert({ provider: 'openai', apiKey: 'sk-live' });
    expect(state.status).toBe('configured');
    expect(upsertApiKey).toHaveBeenCalledTimes(1);
    expect(upsertApiKey.mock.calls[0]?.[1].startsWith('enc:v1:')).toBe(true);
  });

  it('fails upsert when master key is missing', async () => {
    const { engine, upsertApiKey } = createEngine(undefined);
    await expect(engine.upsert({ provider: 'openai', apiKey: 'sk-live' })).rejects.toMatchObject({
      code: 'PRECONDITION_FAILED',
    });
    expect(upsertApiKey).not.toHaveBeenCalled();
  });

  it('lists supported providers with missing status', async () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const { engine } = createEngine(key);
    const providers = await engine.listProviders();
    expect(providers).toHaveLength(2);
    const anthropic = providers.find((entry) => entry.provider === 'anthropic');
    expect(anthropic?.status).toBe('missing');
  });

  it('returns missing state when revoke target does not exist', async () => {
    const key = Buffer.alloc(32, 7).toString('base64');
    const { engine, revokeApiKey } = createEngine(key);
    revokeApiKey.mockResolvedValueOnce(null);
    const state = await engine.revoke({ provider: 'anthropic' });
    expect(state.status).toBe('missing');
  });
});
