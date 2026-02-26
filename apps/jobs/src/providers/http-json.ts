import http from 'node:http';
import https from 'node:https';

export interface HttpJsonResponse {
  statusCode: number;
  textBody: string;
  jsonBody: unknown;
}

export interface HttpJsonRequestOptions {
  method: 'GET' | 'POST';
  timeoutMs: number;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface RetryEvent {
  attempt: number;
  delayMs: number;
  reason: string;
}

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  isRetryable: (error: unknown) => boolean;
  onRetry?: (event: RetryEvent) => void;
}

export interface RetryDeps {
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}

export function asErrorReason(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown transport error';
}

export function retryDelayMs(
  baseDelayMs: number,
  attempt: number,
  random: () => number
): number {
  const boundedExponential = Math.min(baseDelayMs * 2 ** (attempt - 1), 4000);
  const jitter = Math.floor(random() * Math.max(25, baseDelayMs));
  return boundedExponential + jitter;
}

async function defaultSleep(delayMs: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  deps: RetryDeps = {}
): Promise<T> {
  const maxAttempts = options.maxRetries + 1;
  const random = deps.random || (() => Math.random());
  const sleep = deps.sleep || defaultSleep;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!options.isRetryable(error) || attempt >= maxAttempts) {
        throw error;
      }
      const delayMs = retryDelayMs(options.baseDelayMs, attempt, random);
      options.onRetry?.({
        attempt,
        delayMs,
        reason: asErrorReason(error),
      });
      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Retry operation failed.');
}

export async function requestJsonWithNode(
  url: URL,
  options: HttpJsonRequestOptions
): Promise<HttpJsonResponse> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const bodyText = options.body === undefined ? null : JSON.stringify(options.body);
    const request = client.request(
      url,
      {
        method: options.method,
        timeout: options.timeoutMs,
        headers: {
          ...(bodyText
            ? {
                'content-type': 'application/json',
                'content-length': String(Buffer.byteLength(bodyText)),
              }
            : {}),
          ...(options.headers || {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on('end', () => {
          const textBody = Buffer.concat(chunks).toString('utf8');
          let jsonBody: unknown = {};
          if (textBody.trim().length > 0) {
            try {
              jsonBody = JSON.parse(textBody);
            } catch {
              jsonBody = null;
            }
          }
          resolve({
            statusCode: response.statusCode || 500,
            textBody,
            jsonBody,
          });
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error(`HTTP request timeout after ${options.timeoutMs}ms`));
    });

    request.on('error', (error) => {
      reject(error);
    });

    if (bodyText) {
      request.write(bodyText);
    }
    request.end();
  });
}
