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

export async function waitForScoringMetrics(
  db,
  runId,
  dimensionId,
  timeoutMs
) {
  return waitFor(
    'scoring metrics',
    async () => {
      const rows = await db.query(
        `SELECT
           COUNT(*)::int AS "objectCount",
           COUNT(os."id")::int AS "scoredCount",
           MIN(os."createdAt") AS "firstScoreAt"
         FROM "stream_run_objects" sro
         LEFT JOIN "object_scores" os
           ON os."objectId" = sro."objectId"
          AND os."dimensionId" = $2
         WHERE sro."streamRunId" = $1`,
        [runId, dimensionId]
      );
      const objectCount = Number(rows.rows[0]?.objectCount || 0);
      const scoredCount = Number(rows.rows[0]?.scoredCount || 0);
      const firstScoreAt = rows.rows[0]?.firstScoreAt
        ? new Date(rows.rows[0].firstScoreAt)
        : null;
      if (objectCount === 0 || scoredCount === 0 || !firstScoreAt) {
        return null;
      }
      return { objectCount, scoredCount, firstScoreAt };
    },
    timeoutMs
  );
}

export function createTransientOpenAlexMockServer(seed, includeAuthorships = true) {
  const works = createOpenAlexMockWorks(seed, includeAuthorships);
  let transientFailurePending = true;

  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', 'http://127.0.0.1');
    if (url.pathname !== '/works') {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: 'not found' }));
      return;
    }

    const page = Number(url.searchParams.get('page') || '1');
    if (page === 1 && transientFailurePending) {
      transientFailurePending = false;
      response.statusCode = 503;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({ error: 'transient outage injected for S1.EXIT' })
      );
      return;
    }

    response.statusCode = 200;
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ results: page === 1 ? works : [] }));
  });

  return {
    server,
    externalIds: works.map((work) => work.id),
    didInjectTransient: () => transientFailurePending === false,
  };
}
