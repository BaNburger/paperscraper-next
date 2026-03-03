import { describe, expect, it, vi } from 'vitest';
import {
  OpenAlexPermanentError,
  type OpenAlexRetryLog,
  OpenAlexTransientError,
  createOpenAlexProvider,
} from './openalex-provider';

function createConfig() {
  return {
    baseUrl: 'https://api.openalex.org',
    apiKey: 'test-key',
    timeoutMs: 1000,
    maxRetries: 2,
    baseDelayMs: 1,
  };
}

describe('openalex provider', () => {
  it('fetches parsed works and uses filter query mode', async () => {
    const requestJson = vi.fn(async (url: URL) => {
      expect(url.pathname).toBe('/works');
      expect(url.searchParams.get('filter')).toBe('publication_year:2024');
      expect(url.searchParams.get('search')).toBeNull();
      expect(url.searchParams.get('select')).toContain('display_name');
      expect(url.searchParams.get('select')).toContain('authorships');
      expect(url.searchParams.get('api_key')).toBe('test-key');
      return {
        results: [
          {
            id: 'https://openalex.org/W1',
            display_name: 'Paper One',
            publication_date: '2024-01-10',
            abstract_inverted_index: {
              network: [1],
              graph: [0],
            },
            authorships: [
              {
                author: {
                  id: 'https://openalex.org/A1',
                  display_name: 'Ada Lovelace',
                },
              },
            ],
          },
          {
            display_name: 'Missing id should fail',
          },
        ],
      };
    });

    const provider = createOpenAlexProvider(createConfig(), {
      requestJson,
      sleep: async () => undefined,
      random: () => 0,
    });

    const result = await provider.fetchWorks('filter:publication_year:2024', 100);
    expect(result.processedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.works).toHaveLength(1);
    expect(result.works[0]!.display_name).toBe('Paper One');
    expect(result.works[0]!.id).toBe('https://openalex.org/W1');
  });

  it('retries transient failures with bounded attempts', async () => {
    let attempts = 0;
    const retries: OpenAlexRetryLog[] = [];
    const provider = createOpenAlexProvider(createConfig(), {
      requestJson: async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new OpenAlexTransientError('temporary outage');
        }
        return { results: [] };
      },
      sleep: async () => undefined,
      random: () => 0,
    });

    await provider.fetchWorks('search:knowledge graph', 50, (entry) => {
      retries.push(entry);
    });

    expect(attempts).toBe(2);
    expect(retries).toHaveLength(1);
    expect(retries[0]!.attempt).toBe(1);
  });

  it('fails fast on permanent adapter failures', async () => {
    const provider = createOpenAlexProvider(createConfig(), {
      requestJson: async () => {
        throw new OpenAlexPermanentError('bad request');
      },
      sleep: async () => undefined,
      random: () => 0,
    });

    await expect(provider.fetchWorks('search:llm', 10)).rejects.toBeInstanceOf(OpenAlexPermanentError);
  });

  it('supports anonymous OpenAlex mode when API key is not set', async () => {
    const requestJson = vi.fn(async (url: URL) => {
      expect(url.searchParams.get('api_key')).toBeNull();
      return { results: [] };
    });

    const provider = createOpenAlexProvider(
      {
        ...createConfig(),
        apiKey: '',
      },
      {
        requestJson,
        sleep: async () => undefined,
        random: () => 0,
      }
    );

    const result = await provider.fetchWorks('search:llm', 10);
    expect(result.works).toHaveLength(0);
    expect(result.processedCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });
});
