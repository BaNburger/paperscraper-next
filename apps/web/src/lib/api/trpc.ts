import {
  DEFAULT_API_BASE_URL,
  DEFAULT_TRPC_PATH,
  type HealthSnapshot,
  healthSnapshotSchema,
} from '@paperscraper/shared/browser';
import { createTRPCUntypedClient, httpBatchLink } from '@trpc/client';
import { z } from 'zod';

export const TRPC_PATH = DEFAULT_TRPC_PATH;

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return normalizeBaseUrl(String(import.meta.env.VITE_API_BASE_URL));
  }
  return DEFAULT_API_BASE_URL;
}

export function decodeHealthSnapshot(value: unknown): HealthSnapshot {
  return healthSnapshotSchema.parse(value);
}

const trpc = createTRPCUntypedClient({
  links: [
    httpBatchLink({
      url: `${getApiBaseUrl()}${TRPC_PATH}`,
    }),
  ],
});

export async function trpcQuery<TInput, TOutput>(
  path: string,
  input: TInput,
  outputSchema: z.ZodType<TOutput>
): Promise<TOutput> {
  const result = await trpc.query(path, input);
  return outputSchema.parse(result);
}

export async function trpcMutation<TInput, TOutput>(
  path: string,
  input: TInput,
  outputSchema: z.ZodType<TOutput>
): Promise<TOutput> {
  const result = await trpc.mutation(path, input);
  return outputSchema.parse(result);
}
