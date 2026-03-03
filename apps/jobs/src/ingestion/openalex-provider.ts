import { z } from 'zod';
import { streamQuerySchema } from '@paperscraper/shared';
import {
  asErrorReason,
  requestJsonWithNode,
  withRetry,
  type RetryEvent,
} from '../providers/http-json';

const OPENALEX_WORKS_PATH = '/works';
const OPENALEX_SELECT_FIELDS =
  'id,display_name,abstract_inverted_index,publication_date,authorships';
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
  authorships: z
    .array(
      z.object({
        author: z
          .object({
            id: z.string().min(1).nullish(),
            display_name: z.string().min(1).nullish(),
          })
          .nullish(),
      })
    )
    .nullish(),
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

function createWorksUrl(
  config: OpenAlexProviderConfig,
  mode: QueryMode,
  value: string,
  page: number,
  perPage: number
): URL {
  const url = new URL(OPENALEX_WORKS_PATH, config.baseUrl);
  if (config.apiKey.trim().length > 0) {
    url.searchParams.set('api_key', config.apiKey);
  }
  url.searchParams.set(mode, value);
  url.searchParams.set('per-page', String(perPage));
  url.searchParams.set('page', String(page));
  url.searchParams.set('select', OPENALEX_SELECT_FIELDS);
  return url;
}

function classifyResponseError(statusCode: number, body: string): Error {
  const message = `OpenAlex request failed with status ${statusCode}`;
  if (statusCode === 429 || statusCode >= 500) {
    return new OpenAlexTransientError(message);
  }
  const suffix = body.trim().length > 0 ? `: ${body.slice(0, 200)}` : '';
  return new OpenAlexPermanentError(`${message}${suffix}`);
}

function isRetryable(error: unknown): boolean {
  return error instanceof OpenAlexTransientError;
}

function defaultDeps(): OpenAlexProviderDeps {
  return {
    requestJson: async (url, timeoutMs) => {
      const response = await requestJsonWithNode(url, {
        method: 'GET',
        timeoutMs,
      });
      if (response.statusCode >= 400) {
        throw classifyResponseError(response.statusCode, response.textBody);
      }
      if (response.jsonBody === null) {
        throw new OpenAlexPermanentError('OpenAlex returned invalid JSON payload.');
      }
      return response.jsonBody;
    },
    random: () => Math.random(),
    sleep: async (delayMs) => {
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    },
  };
}

async function fetchPageWithRetry(
  config: OpenAlexProviderConfig,
  deps: OpenAlexProviderDeps,
  url: URL,
  onRetry: ((event: OpenAlexRetryLog) => void) | undefined
): Promise<unknown> {
  try {
    return await withRetry(
      () => deps.requestJson(url, config.timeoutMs),
      {
        maxRetries: config.maxRetries,
        baseDelayMs: config.baseDelayMs,
        isRetryable,
        onRetry: (event: RetryEvent) => {
          onRetry?.(event);
        },
      },
      {
        random: deps.random,
        sleep: deps.sleep,
      }
    );
  } catch (error) {
    if (error instanceof OpenAlexPermanentError || error instanceof OpenAlexTransientError) {
      throw error;
    }
    throw new OpenAlexTransientError(asErrorReason(error));
  }
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
