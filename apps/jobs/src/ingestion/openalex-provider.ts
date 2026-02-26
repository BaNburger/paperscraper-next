import http from 'node:http';
import https from 'node:https';
import { z } from 'zod';
import { streamQuerySchema } from '@paperscraper/shared';

const OPENALEX_WORKS_PATH = '/works';
const OPENALEX_SELECT_FIELDS = 'id,display_name,abstract_inverted_index,publication_date';
const OPENALEX_PER_PAGE_LIMIT = 200;

const openAlexResponseSchema = z.object({
  results: z.array(z.unknown()).default([]),
});

export const openAlexWorkSchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1),
  abstract_inverted_index: z
    .record(z.string(), z.array(z.number().int().nonnegative()))
    .nullish(),
  publication_date: z.string().min(1).nullish(),
});

type QueryMode = 'filter' | 'search';
export type OpenAlexWork = z.infer<typeof openAlexWorkSchema>;

export interface OpenAlexProviderConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxRetries: number;
  baseDelayMs: number;
}

export interface OpenAlexRetryLog {
  attempt: number;
  delayMs: number;
  reason: string;
}

export interface OpenAlexFetchResult {
  works: OpenAlexWork[];
  processedCount: number;
  failedCount: number;
}

interface OpenAlexProviderDeps {
  requestJson: (url: URL, timeoutMs: number) => Promise<unknown>;
  random: () => number;
  sleep: (delayMs: number) => Promise<void>;
}

export class OpenAlexPermanentError extends Error {}
export class OpenAlexTransientError extends Error {}

function parseQuery(query: string): { mode: QueryMode; value: string } {
  const parsed = streamQuerySchema.parse(query);
  if (parsed.startsWith('filter:')) {
    return { mode: 'filter', value: parsed.slice('filter:'.length).trim() };
  }
  return { mode: 'search', value: parsed.slice('search:'.length).trim() };
}

function retryDelayMs(baseDelayMs: number, attempt: number, random: () => number): number {
  const boundedExponential = Math.min(baseDelayMs * 2 ** (attempt - 1), 4000);
  const jitter = Math.floor(random() * Math.max(25, baseDelayMs));
  return boundedExponential + jitter;
}

function asErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown OpenAlex error';
}

function createWorksUrl(
  config: OpenAlexProviderConfig,
  mode: QueryMode,
  value: string,
  page: number,
  perPage: number
): URL {
  const url = new URL(OPENALEX_WORKS_PATH, config.baseUrl);
  url.searchParams.set('api_key', config.apiKey);
  url.searchParams.set(mode, value);
  url.searchParams.set('per-page', String(perPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('select', OPENALEX_SELECT_FIELDS);
  return url;
}

function classifyResponseError(statusCode: number, body: unknown): Error {
  const message = `OpenAlex request failed with status ${statusCode}`;
  if (statusCode === 429 || statusCode >= 500) {
    return new OpenAlexTransientError(message);
  }
  const suffix = typeof body === 'string' && body.trim().length > 0 ? `: ${body.slice(0, 200)}` : '';
  return new OpenAlexPermanentError(`${message}${suffix}`);
}

function isRetryable(error: unknown): boolean {
  return error instanceof OpenAlexTransientError;
}

async function requestJsonWithNode(url: URL, timeoutMs: number): Promise<unknown> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      { method: 'GET', timeout: timeoutMs },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          const textBody = Buffer.concat(chunks).toString('utf8');
          const statusCode = response.statusCode || 500;
          if (statusCode >= 400) {
            reject(classifyResponseError(statusCode, textBody));
            return;
          }
          if (!textBody) {
            resolve({});
            return;
          }
          try {
            resolve(JSON.parse(textBody));
          } catch {
            reject(new OpenAlexPermanentError('OpenAlex returned invalid JSON payload.'));
          }
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(
        new OpenAlexTransientError(`OpenAlex request timeout after ${timeoutMs}ms`)
      );
    });

    request.on('error', (error) => {
      if (error instanceof OpenAlexPermanentError || error instanceof OpenAlexTransientError) {
        reject(error);
        return;
      }
      reject(new OpenAlexTransientError(asErrorReason(error)));
    });

    request.end();
  });
}

function defaultDeps(): OpenAlexProviderDeps {
  return {
    requestJson: requestJsonWithNode,
    random: () => Math.random(),
    sleep: (delayMs: number) =>
      new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      }),
  };
}

async function fetchPageWithRetry(
  config: OpenAlexProviderConfig,
  deps: OpenAlexProviderDeps,
  url: URL,
  onRetry: ((event: OpenAlexRetryLog) => void) | undefined
): Promise<unknown> {
  const maxAttempts = config.maxRetries + 1;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await deps.requestJson(url, config.timeoutMs);
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt >= maxAttempts) {
        throw error;
      }
      const delayMs = retryDelayMs(config.baseDelayMs, attempt, deps.random);
      onRetry?.({ attempt, delayMs, reason: asErrorReason(error) });
      await deps.sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new OpenAlexTransientError('OpenAlex request failed.');
}

export function createOpenAlexProvider(
  config: OpenAlexProviderConfig,
  overrides: Partial<OpenAlexProviderDeps> = {}
) {
  const deps = { ...defaultDeps(), ...overrides };

  return {
    async fetchWorks(
      query: string,
      maxObjects: number,
      onRetry?: (event: OpenAlexRetryLog) => void
    ): Promise<OpenAlexFetchResult> {
      if (!config.apiKey.trim()) {
        throw new OpenAlexPermanentError(
          'OPENALEX_API_KEY is required for OpenAlex ingestion.'
        );
      }

      const { mode, value } = parseQuery(query);
      const pageLimit = Math.min(Math.max(maxObjects, 1), OPENALEX_PER_PAGE_LIMIT);
      const works: OpenAlexWork[] = [];
      let processedCount = 0;
      let failedCount = 0;
      let page = 1;

      while (works.length < maxObjects) {
        const remaining = maxObjects - works.length;
        const perPage = Math.min(pageLimit, remaining);
        const requestUrl = createWorksUrl(config, mode, value, page, perPage);
        const responseJson = await fetchPageWithRetry(config, deps, requestUrl, onRetry);
        const response = openAlexResponseSchema.parse(responseJson);

        if (response.results.length === 0) {
          break;
        }

        for (const rawResult of response.results) {
          if (works.length >= maxObjects) {
            break;
          }
          processedCount += 1;
          const parsed = openAlexWorkSchema.safeParse(rawResult);
          if (!parsed.success) {
            failedCount += 1;
            continue;
          }
          works.push(parsed.data);
        }

        if (response.results.length < perPage) {
          break;
        }
        page += 1;
      }

      return {
        works,
        processedCount,
        failedCount,
      };
    },
  };
}
