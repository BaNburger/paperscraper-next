import http from 'node:http';
import { requestJson, trpcQuery, waitFor } from './runtime-utils.mjs';

export function createOpenAlexMockWorks(seed, includeAuthorships = false) {
  const baseWorks = [
    {
      id: `https://openalex.org/W${seed}01`,
      display_name: 'Deterministic Stream Paper A',
      publication_date: '2024-01-01',
      abstract_inverted_index: { paper: [0], deterministic: [1], alpha: [2] },
    },
    {
      id: `https://openalex.org/W${seed}02`,
      display_name: 'Deterministic Stream Paper B',
      publication_date: '2024-01-02',
      abstract_inverted_index: { paper: [0], deterministic: [1], beta: [2] },
    },
  ];
  if (!includeAuthorships) {
    return baseWorks;
  }
  return baseWorks.map((work) => ({
    ...work,
    authorships: [
      {
        author: {
          id: `https://openalex.org/A${seed}01`,
          display_name: 'Ada Lovelace',
        },
      },
    ],
  }));
}

export function createOpenAlexMockServer(works) {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/works') {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    const page = Number(url.searchParams.get('page') || '1');
    response.statusCode = 200;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ results: page === 1 ? works : [] }));
  });
  return {
    server,
    externalIds: works.map((work) => work.id),
  };
}

export async function waitForHealthyApi(baseUrl, timeoutMs) {
  return waitFor(
    'healthy API',
    async () => {
      const health = await requestJson(`${baseUrl}/health`);
      return health.body?.status === 'ok' ? health.body : null;
    },
    timeoutMs
  );
}

export async function waitForJobsReady(jobsHandle, timeoutMs) {
  return waitFor(
    'jobs readiness',
    async () =>
      jobsHandle.jsonLogs.find(
        (entry) => entry.component === 'jobs-worker' && entry.state === 'ready'
      ) || null,
    timeoutMs
  );
}

export async function waitForRunTerminal(
  baseUrl,
  trpcPath,
  streamId,
  runId,
  timeoutMs,
  limit = 10
) {
  return waitFor(
    `run ${runId} terminal status`,
    async () => {
      const runs = await trpcQuery(baseUrl, trpcPath, 'streams.runs', { streamId, limit });
      if (!Array.isArray(runs)) {
        return null;
      }
      const run = runs.find((item) => item.id === runId);
      if (!run) {
        return null;
      }
      return ['succeeded', 'failed'].includes(run.status) ? run : null;
    },
    timeoutMs
  );
}
