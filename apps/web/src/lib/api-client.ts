import {
  DEFAULT_API_BASE_URL,
  DEFAULT_TRPC_PATH,
  healthSnapshotSchema,
  type HealthSnapshot,
} from '@paperscraper/shared';

export const TRPC_PATH = DEFAULT_TRPC_PATH;

export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    const configured = String(import.meta.env.VITE_API_BASE_URL);
    return configured.endsWith('/') ? configured.slice(0, -1) : configured;
  }
  return DEFAULT_API_BASE_URL;
}

export function decodeHealthSnapshot(value: unknown): HealthSnapshot {
  return healthSnapshotSchema.parse(value);
}
