import { describe, expect, it } from 'vitest';
import {
  decodeHealthSnapshot,
  getApiBaseUrl,
  TRPC_PATH,
} from './api-client';

describe('api client scaffold', () => {
  it('uses fallback defaults', () => {
    expect(getApiBaseUrl()).toBe('http://localhost:4000');
    expect(TRPC_PATH).toBe('/trpc');
  });

  it('parses health payloads with the shared contract', () => {
    const payload = {
      status: 'ok',
      timestamp: '2026-02-24T00:00:00.000Z',
      dependencies: {
        postgres: { status: 'ready', latencyMs: 5 },
        redis: { status: 'ready', latencyMs: 4 },
      },
    };

    expect(decodeHealthSnapshot(payload).status).toBe('ok');
  });
});
