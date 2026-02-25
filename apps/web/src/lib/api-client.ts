import {
  healthSnapshotSchema,
  type HealthSnapshot,
} from '@paperscraper/shared';

export const TRPC_PATH = '/trpc';

export function getApiBaseUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    const configured = String(import.meta.env.VITE_API_BASE_URL);
    return configured.endsWith('/') ? configured.slice(0, -1) : configured;
  }
  return 'http://localhost:4000';
}

export function decodeHealthSnapshot(value: unknown): HealthSnapshot {
  return healthSnapshotSchema.parse(value);
}
