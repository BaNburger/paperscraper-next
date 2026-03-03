import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { requestJsonWithNode } from './http-json';

let server: http.Server | null = null;

afterEach(async () => {
  if (!server) {
    return;
  }
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  server = null;
});

async function startServer(
  handler: (request: http.IncomingMessage, response: http.ServerResponse) => void
): Promise<URL> {
  server = http.createServer(handler);
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server.');
  }
  return new URL(`http://127.0.0.1:${address.port}/`);
}

describe('http-json transport', () => {
  it('returns parsed JSON response body', async () => {
    const baseUrl = await startServer((_request, response) => {
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true }));
    });

    const result = await requestJsonWithNode(baseUrl, {
      method: 'GET',
      timeoutMs: 500,
    });

    expect(result.statusCode).toBe(200);
    expect(result.jsonBody).toEqual({ ok: true });
  });

  it('fails fast when response does not complete before timeout', async () => {
    const baseUrl = await startServer(() => {
      // Keep the connection open to validate hard timeout behavior.
    });

    const startedAt = Date.now();
    await expect(
      requestJsonWithNode(baseUrl, {
        method: 'GET',
        timeoutMs: 120,
      })
    ).rejects.toThrow('HTTP request timeout');
    expect(Date.now() - startedAt).toBeLessThan(1200);
  });
});
