import {
  healthSnapshotSchema,
  type HealthSnapshot,
} from '@paperscraper/shared';

export const TRPC_PATH = '/trpc';

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    return String(import.meta.env.VITE_API_BASE_URL);
  }
  return 'http://localhost:4000';
}

export function decodeHealthSnapshot(value: unknown): HealthSnapshot {
  return healthSnapshotSchema.parse(value);
}

export function getApiConfig() {
  return {
    baseUrl: normalizeBaseUrl(getApiBaseUrl()),
    trpcPath: TRPC_PATH,
  };
}
