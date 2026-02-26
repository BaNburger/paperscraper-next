import http from 'node:http';
import { Client } from 'pg';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { projectRoot, runCommand } from '../lib/common.mjs';
import {
  assert,
  createProcess,
  findFreePort,
  loadRuntimeEnv,
  parseVerifyMode,
  requestJson,
  runWorkspaceChecks,
  stopProcess,
  trpcMutation,
  trpcQuery,
  waitFor,
} from './runtime-utils.mjs';
import {
  createOpenAlexMockServer,
  createOpenAlexMockWorks,
  waitForHealthyApi,
  waitForJobsReady,
  waitForRunTerminal,
} from './runtime-harness.mjs';

const STARTUP_TIMEOUT_MS = 25000;
const SHUTDOWN_TIMEOUT_MS = 3000;
const REQUIRED_WORKSPACES = ['apps/api', 'apps/jobs', 'packages/shared', 'packages/db'];

async function probeLiveOpenAlex(apiKey) {
  if (!apiKey.trim()) {
    console.warn('[verify-s1_2] warning: OPENALEX_API_KEY missing, live OpenAlex probe skipped.');
    return;
  }
  const url = new URL('/works?search=graph&per-page=1&select=id', 'https://api.openalex.org');
  url.searchParams.set('api_key', apiKey);
  const response = await requestJson(url.toString(), { timeoutMs: 5000 });
  if (response.statusCode >= 400 || !response.body?.results) {
    const code = response.statusCode || 0;
    console.warn(`[verify-s1_2] warning: live OpenAlex probe unavailable (status=${code}).`);
    return;
  }
  console.log('[verify-s1_2] live OpenAlex probe succeeded.');
}

async function runRuntimeSmoke(root, runtimeEnv) {
  const apiPort = await findFreePort();
  const mockPort = await findFreePort();
  const token = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const mock = createOpenAlexMockServer(createOpenAlexMockWorks(token, false));
  await new Promise((resolve) => mock.server.listen(mockPort, '127.0.0.1', resolve));
  const mockBaseUrl = `http://127.0.0.1:${mockPort}`;
  const baseUrl = `http://localhost:${apiPort}`;
  const trpcPath = runtimeEnv.TRPC_PATH || '/trpc';

  const smokeEnv = {
    ...runtimeEnv,
    API_PORT: String(apiPort),
    OPENALEX_BASE_URL: mockBaseUrl,
    OPENALEX_API_KEY: runtimeEnv.OPENALEX_API_KEY || 'local-smoke-key',
  };

  const redis = new IORedis(runtimeEnv.REDIS_URL);
  const graphQueue = new Queue(runtimeEnv.GRAPH_QUEUE_NAME, { connection: redis });
  const api = createProcess(root, 'npm', ['run', 'dev:api'], smokeEnv, 'api-s1_2');
  const jobs = createProcess(root, 'npm', ['run', 'dev:jobs'], smokeEnv, 'jobs-s1_2');
  try {
    await waitForHealthyApi(baseUrl, STARTUP_TIMEOUT_MS);
    await waitForJobsReady(jobs, STARTUP_TIMEOUT_MS);

    const beforeCounts = await graphQueue.getJobCounts('waiting', 'active', 'delayed');
    const beforeGraphDepth = (beforeCounts.waiting || 0) + (beforeCounts.active || 0) + (beforeCounts.delayed || 0);

    const created = await trpcMutation(baseUrl, trpcPath, 'streams.create', {
      name: 'S1.2 smoke stream',
      query: 'search:deterministic',
      maxObjects: 5,
    });
    assert(created && !created.error, 'streams.create failed during smoke run.');
    const streamId = created.id;
    assert(streamId, 'streams.create did not return stream id.');

    const firstRun = await trpcMutation(baseUrl, trpcPath, 'streams.trigger', { id: streamId });
    assert(firstRun && !firstRun.error, 'streams.trigger first run failed.');
    const firstTerminal = await waitForRunTerminal(
      baseUrl,
      trpcPath,
      streamId,
      firstRun.id,
      STARTUP_TIMEOUT_MS,
      5
    );
    assert(firstTerminal.status === 'succeeded', `First run failed: ${firstTerminal.failureReason || 'unknown'}`);
    assert(firstTerminal.insertedCount > 0, 'Expected first run to insert objects.');

    await waitFor(
      'object.created evidence',
      async () => {
        const afterFirstCounts = await graphQueue.getJobCounts('waiting', 'active', 'delayed');
        const afterFirstGraphDepth =
          (afterFirstCounts.waiting || 0) +
          (afterFirstCounts.active || 0) +
          (afterFirstCounts.delayed || 0);
        if (afterFirstGraphDepth > beforeGraphDepth) {
          return { mode: 'queue-depth' };
        }
        const graphReadyLogs = jobs.jsonLogs.filter(
          (entry) =>
            entry &&
            entry.component === 'jobs-worker' &&
            entry.state === 'ready' &&
            typeof entry.objectId === 'string' &&
            typeof entry.linkedCount === 'number'
        );
        return graphReadyLogs.length > 0 ? { mode: 'graph-log' } : null;
      },
      STARTUP_TIMEOUT_MS
    );

    const secondRun = await trpcMutation(baseUrl, trpcPath, 'streams.trigger', { id: streamId });
    assert(secondRun && !secondRun.error, 'streams.trigger second run failed.');
    const secondTerminal = await waitForRunTerminal(
      baseUrl,
      trpcPath,
      streamId,
      secondRun.id,
      STARTUP_TIMEOUT_MS,
      5
    );
    assert(secondTerminal.status === 'succeeded', `Second run failed: ${secondTerminal.failureReason || 'unknown'}`);
    assert(secondTerminal.insertedCount === 0, 'Expected second run dedup to insert zero objects.');

    const db = new Client({ connectionString: runtimeEnv.DATABASE_URL });
    await db.connect();
    const dedupRows = await db.query(
      'SELECT "externalId", COUNT(*)::int AS count FROM "research_objects" WHERE "source"=$1 AND "externalId" = ANY($2) GROUP BY "externalId"',
      ['openalex', mock.externalIds]
    );
    await db.end();
    assert(dedupRows.rows.length === mock.externalIds.length, 'Expected all mocked external ids in research_objects.');
    for (const row of dedupRows.rows) {
      assert(Number(row.count) === 1, `Dedup violation for ${row.externalId}.`);
    }
  } finally {
    await stopProcess(api, SHUTDOWN_TIMEOUT_MS);
    await stopProcess(jobs, SHUTDOWN_TIMEOUT_MS);
    await graphQueue.close();
    await redis.quit().catch(() => redis.disconnect());
    await new Promise((resolve) => mock.server.close(() => resolve()));
  }
}

async function main() {
  const root = projectRoot();
  const mode = parseVerifyMode(process.argv.slice(2), 'runtime');
  const runtimeEnv = loadRuntimeEnv(root, {
    API_PORT: '4000',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/paperscraper_next?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    TRPC_PATH: '/trpc',
    JOB_QUEUE_NAME: 'psn.foundation',
    GRAPH_QUEUE_NAME: 'psn.object.created',
    OPENALEX_BASE_URL: 'https://api.openalex.org',
    OPENALEX_API_KEY: '',
  });

  process.env.DATABASE_URL = runtimeEnv.DATABASE_URL;
  runWorkspaceChecks(REQUIRED_WORKSPACES, 'verify-s1_2');
  runCommand('bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy', {
    context: 'verify-s1_2:migrate',
  });
  if (mode === 'runtime') {
    await probeLiveOpenAlex(runtimeEnv.OPENALEX_API_KEY);
    await runRuntimeSmoke(root, runtimeEnv);
  }
  console.log(`[verify-s1_2] passed (mode=${mode}).`);
}

main().catch((error) => {
  console.error(`[verify-s1_2] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
