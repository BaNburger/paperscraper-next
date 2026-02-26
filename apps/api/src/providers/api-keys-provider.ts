import type { PrismaClient } from '@paperscraper/db';

type ApiKeyRow = {
  provider: 'openai' | 'anthropic';
  encryptedKey: string;
  updatedAt: Date;
  revokedAt: Date | null;
};

export interface ApiKeysProviderDeps {
  upsertApiKey: (provider: 'openai' | 'anthropic', encryptedKey: string) => Promise<ApiKeyRow>;
  revokeApiKey: (provider: 'openai' | 'anthropic') => Promise<ApiKeyRow | null>;
  listApiKeys: () => Promise<ApiKeyRow[]>;
}

const apiKeySelect = {
  provider: true,
  encryptedKey: true,
  updatedAt: true,
  revokedAt: true,
} as const;

export function createApiKeysProvider(prisma: PrismaClient): ApiKeysProviderDeps {
  return {
    upsertApiKey: async (provider, encryptedKey) => {
      const row = await prisma.apiKey.upsert({
        where: { provider },
        update: {
          encryptedKey,
          revokedAt: null,
        },
        create: {
          provider,
          encryptedKey,
          revokedAt: null,
        },
        select: apiKeySelect,
      });
      return { ...row, provider: row.provider };
    },

    revokeApiKey: async (provider) => {
      const existing = await prisma.apiKey.findUnique({
        where: { provider },
        select: apiKeySelect,
      });
      if (!existing) {
        return null;
      }
      const row = await prisma.apiKey.update({
        where: { provider },
        data: { revokedAt: new Date() },
        select: apiKeySelect,
      });
      return { ...row, provider: row.provider };
    },

    listApiKeys: async () => {
      const rows = await prisma.apiKey.findMany({
        orderBy: { provider: 'asc' },
        select: apiKeySelect,
      });
      return rows.map((row) => ({ ...row, provider: row.provider }));
    },
  };
}
