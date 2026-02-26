import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createAnthropicScorer, createOpenAiScorer } from './llm-provider';

let activeServer: http.Server | null = null;

afterEach(async () => {
  if (!activeServer) {
    return;
  }
  await new Promise<void>((resolve) => activeServer?.close(() => resolve()));
  activeServer = null;
});

async function startServer(
  handler: (request: http.IncomingMessage, response: http.ServerResponse) => void
): Promise<string> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  activeServer = server;
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server.');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('llm provider adapters', () => {
  it('parses OpenAI JSON score output', async () => {
    const baseUrl = await startServer((request, response) => {
      expect(request.url).toContain('/v1/chat/completions');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  value: 84,
                  explanation: 'Good fit',
                }),
              },
            },
          ],
        })
      );
    });

    const scorer = createOpenAiScorer({
      baseUrl,
      timeoutMs: 1000,
      maxRetries: 0,
      baseDelayMs: 1,
    });
    const output = await scorer.scoreObject({
      apiKey: 'test-key',
      model: 'gpt-4o-mini',
      dimensionPrompt: 'Score novelty',
      title: 'Paper',
      abstract: 'Abstract',
    });
    expect(output.value).toBe(84);
  });

  it('parses Anthropic JSON score output', async () => {
    const baseUrl = await startServer((request, response) => {
      expect(request.url).toContain('/v1/messages');
      response.statusCode = 200;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                value: 91,
                explanation: 'Excellent fit',
              }),
            },
          ],
        })
      );
    });

    const scorer = createAnthropicScorer({
      baseUrl,
      timeoutMs: 1000,
      maxRetries: 0,
      baseDelayMs: 1,
    });
    const output = await scorer.scoreObject({
      apiKey: 'test-key',
      model: 'claude-3-5-haiku-latest',
      dimensionPrompt: 'Score novelty',
      title: 'Paper',
      abstract: 'Abstract',
    });
    expect(output.value).toBe(91);
  });
});
