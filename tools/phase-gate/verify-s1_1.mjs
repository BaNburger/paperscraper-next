import { projectRoot, runCommand } from '../lib/common.mjs';
import {
  assert,
  createProcess,
  findFreePort,
  formatLogs,
  loadRuntimeEnv,
  parseVerifyMode,
  requestJson,
  runWorkspaceChecks,
  stopProcess,
  waitFor,
} from './runtime-utils.mjs';

const STARTUP_TIMEOUT_MS = 20000;
const SHUTDOWN_TIMEOUT_MS = 3000;
const REQUIRED_WORKSPACES = ['apps/api', 'apps/jobs', 'apps/web', 'packages/shared', 'packages/db'];

function findJobsReadinessLog(jsonLogs) {
  return jsonLogs.find(
    (entry) =>
      entry &&
      entry.component === 'jobs-worker' &&
      ['ready', 'degraded', 'failed'].includes(entry.state)
  );
}

async function runRuntimeSmoke(root, runtimeEnv) {
  const apiPort = await findFreePort();
  const healthUrl = `http://localhost:${apiPort}/health`;
  const trpcUrl = `http://localhost:${apiPort}${runtimeEnv.TRPC_PATH}/system.health?input=%7B%7D`;
  const baseApiEnv = {
    ...runtimeEnv,
    API_PORT: String(apiPort),
  };

  const api = createProcess(root, 'npm', ['run', 'dev:api'], baseApiEnv, 'api');
  const jobs = createProcess(root, 'npm', ['run', 'dev:jobs'], runtimeEnv, 'jobs');
  let degradedApi = null;
  try {
    const health = await waitFor(
      'healthy API',
      async () => {
        const response = await requestJson(healthUrl);
        return response.body?.status === 'ok' ? response.body : null;
      },
      STARTUP_TIMEOUT_MS
    );
    assert(health.dependencies?.postgres?.status === 'ready', 'Expected postgres dependency to be ready.');
    assert(health.dependencies?.redis?.status === 'ready', 'Expected redis dependency to be ready.');

    const trpc = await waitFor(
      'tRPC system health',
      async () => {
        const response = await requestJson(trpcUrl);
        return response.body?.result?.data ? response.body : null;
      },
      STARTUP_TIMEOUT_MS
    );
    assert(trpc.result.data.status === 'ok', 'Expected tRPC system.health to report status ok.');

    const jobsReadiness = await waitFor(
      'jobs readiness log',
      async () => findJobsReadinessLog(jobs.jsonLogs),
      STARTUP_TIMEOUT_MS
    );
    assert(jobsReadiness.state === 'ready', `Expected jobs readiness ready, got ${jobsReadiness.state}.`);

    await stopProcess(api, SHUTDOWN_TIMEOUT_MS);
    const degradedEnv = {
      ...baseApiEnv,
      REDIS_URL: 'redis://127.0.0.1:6399',
    };
    degradedApi = createProcess(root, 'npm', ['run', 'dev:api'], degradedEnv, 'api-degraded');
    const degradedHealth = await waitFor(
      'degraded API health',
      async () => {
        const response = await requestJson(healthUrl);
        return response.body?.status === 'degraded' ? response.body : null;
      },
      STARTUP_TIMEOUT_MS
    );
    assert(
      degradedHealth.dependencies?.redis?.status !== 'ready',
      'Expected degraded API to report redis as unavailable.'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${formatLogs(api)}${formatLogs(jobs)}${formatLogs(degradedApi)}`);
  } finally {
    await stopProcess(degradedApi, SHUTDOWN_TIMEOUT_MS);
    await stopProcess(api, SHUTDOWN_TIMEOUT_MS);
    await stopProcess(jobs, SHUTDOWN_TIMEOUT_MS);
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
  });
  process.env.DATABASE_URL = runtimeEnv.DATABASE_URL;

  runWorkspaceChecks(REQUIRED_WORKSPACES, 'verify-s1_1');
  runCommand('bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy', {
    context: 'verify-s1_1:migrate',
  });
  if (mode === 'runtime') {
    await runRuntimeSmoke(root, runtimeEnv);
  }
  console.log(`[verify-s1_1] passed (mode=${mode}).`);
}

main().catch((error) => {
  console.error(`[verify-s1_1] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
