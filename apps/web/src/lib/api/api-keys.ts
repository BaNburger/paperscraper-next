import {
  apiKeyProviderStateSchema,
  apiKeyRevokeInputSchema,
  apiKeyUpsertInputSchema,
  scoringProviderSchema,
  type ApiKeyProviderState,
  type ScoringProvider,
} from '@paperscraper/shared/browser';
import { z } from 'zod';
import { trpcMutation, trpcQuery } from './trpc';

export async function listApiKeyProviders(): Promise<ApiKeyProviderState[]> {
  return trpcQuery('apiKeys.listProviders', {}, z.array(apiKeyProviderStateSchema));
}

export async function upsertApiKey(
  provider: ScoringProvider,
  apiKey: string
): Promise<ApiKeyProviderState> {
  return trpcMutation(
    'apiKeys.upsert',
    apiKeyUpsertInputSchema.parse({ provider, apiKey }),
    apiKeyProviderStateSchema
  );
}

export async function revokeApiKey(provider: ScoringProvider): Promise<ApiKeyProviderState> {
  return trpcMutation(
    'apiKeys.revoke',
    apiKeyRevokeInputSchema.parse({ provider: scoringProviderSchema.parse(provider) }),
    apiKeyProviderStateSchema
  );
}
