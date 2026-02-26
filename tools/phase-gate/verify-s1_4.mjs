import http from 'node:http';
import https from 'node:https';
import { projectRoot, runCommand } from '../lib/common.mjs';
import {
  assert,
  createProcess,
  findFreePort,
  formatLogs,
  loadRuntimeEnv,
  parseVerifyMode,
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

const STARTUP_TIMEOUT_MS = 45000;
const SHUTDOWN_TIMEOUT_MS = 3000;
const REQUIRED_WORKSPACES = [
  'apps/api',
  'apps/jobs',
  'apps/web',
  'packages/shared',
  'packages/db',
];

function requestText(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(
      target,
      {
        method: 'GET',
        timeout: timeoutMs,
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk.toString();
        });
        response.on('end', () => {
          resolve({
            statusCode: response.statusCode || 500,
            body,
          });
        });
      }
    );
    request.on('timeout', () => {
      request.destroy();
      resolve({ statusCode: 504, body: '' });
    });
    request.on('error', () => resolve({ statusCode: 503, body: '' }));
    request.end();
  });
}

async function waitForWebRoute(baseUrl, path, expectedText) {
  return waitFor(
    `web route ${path}`,
    async () => {
      const response = await requestText(`${baseUrl}${path}`, 4000);
      if (response.statusCode >= 400) {
        return null;
      }
      return response.body.includes(expectedText) ? response.body : null;
    },
    STARTUP_TIMEOUT_MS
  );
}

async function runRuntimeSmoke(root, runtimeEnv) {
  const apiPort = await findFreePort();
  const webPort = await findFreePort();
  const mockPort = await findFreePort();
  const token = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const mock = createOpenAlexMockServer(createOpenAlexMockWorks(token, true));
  await new Promise((resolve) => mock.server.listen(mockPort, '127.0.0.1', resolve));

  const smokeEnv = {
    ...runtimeEnv,
    API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
    VITE_API_BASE_URL: `http://localhost:${apiPort}`,
    OPENALEX_BASE_URL: `http://127.0.0.1:${mockPort}`,
    OPENALEX_API_KEY: runtimeEnv.OPENALEX_API_KEY || 'local-smoke-key',
  };
  const baseUrl = `http://localhost:${apiPort}`;
  const webBaseUrl = `http://localhost:${webPort}`;
  const trpcPath = runtimeEnv.TRPC_PATH || '/trpc';

  const api = createProcess(root, 'npm', ['run', 'dev:api'], smokeEnv, 'api-s1_4');
  const jobs = createProcess(root, 'npm', ['run', 'dev:jobs'], smokeEnv, 'jobs-s1_4');
  const web = createProcess(root, 'npm', ['run', 'dev:web'], smokeEnv, 'web-s1_4');

  try {
    await waitForHealthyApi(baseUrl, STARTUP_TIMEOUT_MS);
    await waitForJobsReady(jobs, STARTUP_TIMEOUT_MS);

    const createdStream = await trpcMutation(baseUrl, trpcPath, 'streams.create', {
      name: 'S1.4 smoke stream',
      query: 'search:frontend pipeline',
      maxObjects: 2,
    });
    assert(createdStream && !createdStream.error, 'streams.create failed.');

    const run = await trpcMutation(baseUrl, trpcPath, 'streams.trigger', {
      id: createdStream.id,
    });
    assert(run && !run.error, 'streams.trigger failed.');
    const terminalRun = await waitForRunTerminal(
      baseUrl,
      trpcPath,
      createdStream.id,
      run.id,
      STARTUP_TIMEOUT_MS,
      10
    );
    assert(terminalRun.status === 'succeeded', `Stream run failed: ${terminalRun.failureReason || 'unknown'}`);

    const feed = await waitFor(
      'objects.feed results',
      async () => {
        const value = await trpcQuery(baseUrl, trpcPath, 'objects.feed', {
          sortBy: 'topScore',
          streamId: createdStream.id,
          limit: 20,
        });
        if (!value || !Array.isArray(value.items) || value.items.length === 0) {
          return null;
        }
        return value;
      },
      STARTUP_TIMEOUT_MS
    );

    const firstObjectId = feed.items[0].id;
    const objectDetail = await waitFor(
      'objects.detail with entity links',
      async () => {
        const value = await trpcQuery(baseUrl, trpcPath, 'objects.detail', {
          objectId: firstObjectId,
        });
        if (!value || !Array.isArray(value.entities) || value.entities.length === 0) {
          return null;
        }
        return value;
      },
      STARTUP_TIMEOUT_MS
    );
    const firstEntityId = objectDetail.entities[0].entityId;
    const entityDetail = await trpcQuery(baseUrl, trpcPath, 'entities.detail', {
      entityId: firstEntityId,
    });
    assert(entityDetail && !entityDetail.error, 'entities.detail failed.');

    const board = await trpcQuery(baseUrl, trpcPath, 'pipelines.getBoard', {});
    assert(board && !board.error, 'pipelines.getBoard failed.');
    assert(Array.isArray(board.stages) && board.stages.length >= 3, 'Expected default pipeline stages.');
    const sourceStage = board.stages[0];
    const targetStage = board.stages[1];

    const boardAfterAdd = await trpcMutation(baseUrl, trpcPath, 'pipelines.addCard', {
      pipelineId: board.pipeline.id,
      stageId: sourceStage.id,
      objectId: firstObjectId,
    });
    assert(boardAfterAdd && !boardAfterAdd.error, 'pipelines.addCard failed.');
    const addedCard = boardAfterAdd.stages
      .flatMap((stage) => stage.cards)
      .find((card) => card.objectId === firstObjectId);
    assert(addedCard, 'Added card not found on board.');

    const boardAfterMove = await trpcMutation(baseUrl, trpcPath, 'pipelines.moveCard', {
      pipelineId: board.pipeline.id,
      cardId: addedCard.id,
      toStageId: targetStage.id,
      toPosition: 0,
    });
    assert(boardAfterMove && !boardAfterMove.error, 'pipelines.moveCard failed.');
    const movedCard = boardAfterMove.stages
      .flatMap((stage) => stage.cards)
      .find((card) => card.id === addedCard.id);
    assert(movedCard && movedCard.stageId === targetStage.id, 'Card move did not persist.');

    const boardAfterRemove = await trpcMutation(baseUrl, trpcPath, 'pipelines.removeCard', {
      pipelineId: board.pipeline.id,
      cardId: addedCard.id,
    });
    assert(boardAfterRemove && !boardAfterRemove.error, 'pipelines.removeCard failed.');
    const removedCard = boardAfterRemove.stages
      .flatMap((stage) => stage.cards)
      .find((card) => card.id === addedCard.id);
    assert(!removedCard, 'Card should be removed from board.');

    await waitForWebRoute(webBaseUrl, '/feed', 'Feed');
    await waitForWebRoute(webBaseUrl, `/objects/${firstObjectId}`, 'Object Detail');
    await waitForWebRoute(webBaseUrl, `/entities/${firstEntityId}`, 'Entity Detail');
    await waitForWebRoute(webBaseUrl, '/pipeline', 'Pipeline Board');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}${formatLogs(api)}${formatLogs(jobs)}${formatLogs(web)}`
    );
  } finally {
    await stopProcess(api, SHUTDOWN_TIMEOUT_MS);
    await stopProcess(jobs, SHUTDOWN_TIMEOUT_MS);
    await stopProcess(web, SHUTDOWN_TIMEOUT_MS);
    await new Promise((resolve) => mock.server.close(() => resolve()));
  }
}

async function main() {
  const root = projectRoot();
  const mode = parseVerifyMode(process.argv.slice(2), 'runtime');
  const runtimeEnv = loadRuntimeEnv(root, {
    API_PORT: '4000',
    WEB_PORT: '3333',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/paperscraper_next?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    TRPC_PATH: '/trpc',
    JOB_QUEUE_NAME: 'psn.foundation',
    GRAPH_QUEUE_NAME: 'psn.object.created',
    OPENALEX_BASE_URL: 'https://api.openalex.org',
    OPENALEX_API_KEY: '',
  });

  process.env.DATABASE_URL = runtimeEnv.DATABASE_URL;
  runWorkspaceChecks(REQUIRED_WORKSPACES, 'verify-s1_4');
  runCommand('npm --prefix apps/web run build', {
    context: 'verify-s1_4:web-build',
  });
  runCommand('node tools/phase-gate/check-web-budgets.mjs', {
    context: 'verify-s1_4:web-budgets',
  });
  runCommand('bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy', {
    context: 'verify-s1_4:migrate',
  });
  if (mode === 'runtime') {
    await runRuntimeSmoke(root, runtimeEnv);
  }
  console.log(`[verify-s1_4] passed (mode=${mode}).`);
}

main().catch((error) => {
  console.error(`[verify-s1_4] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
