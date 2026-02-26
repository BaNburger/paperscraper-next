import { scoreOutputSchema, type ScoreOutput } from '@paperscraper/shared';
import {
  asErrorReason,
  requestJsonWithNode,
  withRetry,
  type RetryDeps,
} from '../providers/http-json';

type RetryConfig = {
  timeoutMs: number;
  maxRetries: number;
  baseDelayMs: number;
};

type ScoringInput = {
  apiKey: string;
  model: string;
  dimensionPrompt: string;
  title: string;
  abstract: string | null;
};

const SYSTEM_PROMPT =
  'You are a strict scoring engine. Return JSON only with value (0-100), explanation, optional metadata.';

export class LlmProviderPermanentError extends Error {}
export class LlmProviderTransientError extends Error {}

function classifyStatus(statusCode: number, responseBody: string): Error {
  const message = `LLM provider request failed with status ${statusCode}`;
  if (statusCode === 429 || statusCode >= 500) {
    return new LlmProviderTransientError(message);
  }
  const suffix = responseBody.trim().length > 0 ? `: ${responseBody.slice(0, 240)}` : '';
  return new LlmProviderPermanentError(`${message}${suffix}`);
}

function normalizeAssistantContent(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return '';
        }
        const maybeText = (entry as { text?: unknown }).text;
        return typeof maybeText === 'string' ? maybeText : '';
      })
      .join('\n')
      .trim();
  }
  return '';
}

function parseScoreResponse(content: string): ScoreOutput {
  if (!content.trim()) {
    throw new LlmProviderPermanentError('LLM provider returned empty score response.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new LlmProviderPermanentError('LLM provider returned non-JSON score response.');
  }
  return scoreOutputSchema.parse(parsed);
}

async function postJsonWithRetry(
  url: URL,
  headers: Record<string, string>,
  body: unknown,
  retry: RetryConfig,
  deps: RetryDeps
): Promise<unknown> {
  try {
    return await withRetry(
      async () => {
        const response = await requestJsonWithNode(url, {
          method: 'POST',
          timeoutMs: retry.timeoutMs,
          headers,
          body,
        });
        if (response.statusCode >= 400) {
          throw classifyStatus(response.statusCode, response.textBody);
        }
        if (response.jsonBody === null) {
          throw new LlmProviderPermanentError('LLM provider returned invalid JSON response.');
        }
        return response.jsonBody;
      },
      {
        maxRetries: retry.maxRetries,
        baseDelayMs: retry.baseDelayMs,
        isRetryable: (error) => error instanceof LlmProviderTransientError,
      },
      deps
    );
  } catch (error) {
    if (error instanceof LlmProviderPermanentError || error instanceof LlmProviderTransientError) {
      throw error;
    }
    throw new LlmProviderTransientError(asErrorReason(error));
  }
}

export function createOpenAiScorer(
  config: RetryConfig & { baseUrl: string },
  overrides: RetryDeps = {}
) {
  return {
    async scoreObject(input: ScoringInput): Promise<ScoreOutput> {
      const url = new URL('/v1/chat/completions', config.baseUrl);
      const body = {
        model: input.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Dimension prompt: ${input.dimensionPrompt}\nTitle: ${input.title}\nAbstract: ${input.abstract || ''}`,
          },
        ],
      };
      const raw = await postJsonWithRetry(
        url,
        { authorization: `Bearer ${input.apiKey}` },
        body,
        config,
        overrides
      );
      const content = normalizeAssistantContent(
        (raw as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
      );
      return parseScoreResponse(content);
    },
  };
}

export function createAnthropicScorer(
  config: RetryConfig & { baseUrl: string },
  overrides: RetryDeps = {}
) {
  return {
    async scoreObject(input: ScoringInput): Promise<ScoreOutput> {
      const url = new URL('/v1/messages', config.baseUrl);
      const body = {
        model: input.model,
        temperature: 0,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Dimension prompt: ${input.dimensionPrompt}\nTitle: ${input.title}\nAbstract: ${input.abstract || ''}`,
          },
        ],
      };
      const raw = await postJsonWithRetry(
        url,
        {
          'x-api-key': input.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body,
        config,
        overrides
      );
      const contentBlocks = (raw as { content?: Array<{ type?: string; text?: string }> }).content || [];
      const content = contentBlocks
        .filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
        .trim();
      return parseScoreResponse(content);
    },
  };
}
