import {
  apiKeyProviderStateSchema,
  apiKeyRevokeInputSchema,
  apiKeyUpsertInputSchema,
  scoringProviderSchema,
  type ApiKeyRevokeInput,
  type ApiKeyUpsertInput,
} from '@paperscraper/shared';
import { encryptSecret, loadOptionalMasterKey } from '@paperscraper/shared';
import { TRPCError } from '@trpc/server';

type ApiKeyRow = {
  provider: 'openai' | 'anthropic';
  encryptedKey: string;
  updatedAt: Date;
  revokedAt: Date | null;
};

export interface ApiKeysEngineDeps {
  upsertApiKey: (provider: 'openai' | 'anthropic', encryptedKey: string) => Promise<ApiKeyRow>;
  revokeApiKey: (provider: 'openai' | 'anthropic') => Promise<ApiKeyRow | null>;
  listApiKeys: () => Promise<ApiKeyRow[]>;
}

export interface ApiKeysEngineOptions {
  secretsMasterKey: string | undefined;
}

const SUPPORTED_PROVIDERS = scoringProviderSchema.options;

function requireMasterKey(value: string | undefined): Buffer {
  const key = loadOptionalMasterKey(value);
  if (!key) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'SECRETS_MASTER_KEY is required for API key operations.',
    });
  }
  return key;
}

function toProviderState(row: ApiKeyRow | null) {
  if (!row) {
    return null;
  }
  return apiKeyProviderStateSchema.parse({
    provider: row.provider,
    status: row.revokedAt ? 'revoked' : 'configured',
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  });
}

export function createApiKeysEngine(
  deps: ApiKeysEngineDeps,
  options: ApiKeysEngineOptions
) {
  return {
    async upsert(input: ApiKeyUpsertInput) {
      const parsed = apiKeyUpsertInputSchema.parse(input);
      const key = requireMasterKey(options.secretsMasterKey);
      const encrypted = encryptSecret(parsed.apiKey, key);
      const upserted = await deps.upsertApiKey(parsed.provider, encrypted);
      const providerState = toProviderState(upserted);
      if (!providerState) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'API key upsert failed.' });
      }
      return providerState;
    },

    async revoke(input: ApiKeyRevokeInput) {
      const parsed = apiKeyRevokeInputSchema.parse(input);
      const revoked = await deps.revokeApiKey(parsed.provider);
      if (!revoked) {
        return apiKeyProviderStateSchema.parse({
          provider: parsed.provider,
          status: 'missing',
          updatedAt: null,
          revokedAt: null,
        });
      }
      const providerState = toProviderState(revoked);
      if (!providerState) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'API key revoke failed.' });
      }
      return providerState;
    },

    async listProviders() {
      const rows = await deps.listApiKeys();
      const byProvider = new Map(rows.map((row) => [row.provider, row]));
      return SUPPORTED_PROVIDERS.map((provider) => {
        const current = toProviderState(byProvider.get(provider) || null);
        if (current) {
          return current;
        }
        return apiKeyProviderStateSchema.parse({
          provider,
          status: 'missing',
          updatedAt: null,
          revokedAt: null,
        });
      });
    },
  };
}

export type ApiKeysEngine = ReturnType<typeof createApiKeysEngine>;
