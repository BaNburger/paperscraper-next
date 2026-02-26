import { Client } from 'pg';
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
} from './runtime-utils.mjs';
import {
  createOpenAlexMockServer,
  createOpenAlexMockWorks,
  waitForHealthyApi,
  waitForJobsReady,
  waitForRunTerminal,
} from './runtime-harness.mjs';
import { waitFor } from './runtime-utils.mjs';

const STARTUP_TIMEOUT_MS = 45000;
const SHUTDOWN_TIMEOUT_MS = 3000;
const REQUIRED_WORKSPACES = ['apps/api', 'apps/jobs', 'packages/shared', 'packages/db'];

function requireRuntimeSecret(name, value) {
  assert(value && value.trim().length > 0, `Missing required runtime env '${name}' for S1.3 smoke.`);
  return value.trim();
}

async function waitForScoringEvidence(db, dimensionIds, externalIds) {
  return waitFor(
    'S1.3 scoring/fold evidence',
    async () => {
      const objectRows = await db.query(
        'SELECT id FROM "research_objects" WHERE "source"=$1 AND "externalId" = ANY($2::text[])',
        ['openalex', externalIds]
      );
      const objectIds = objectRows.rows.map((row) => row.id);
      if (objectIds.length === 0) {
        return null;
      }

      const objectScoreRows = await db.query(
        'SELECT COUNT(*)::int AS count FROM "object_scores" WHERE "dimensionId" = ANY($1::text[]) AND "objectId" = ANY($2::text[])',
        [dimensionIds, objectIds]
      );
      const objectScoreCount = Number(objectScoreRows.rows[0]?.count || 0);
      if (objectScoreCount < dimensionIds.length) {
        return null;
      }

      const entityRows = await db.query(
        'SELECT COUNT(*)::int AS count FROM "entity_scores" WHERE "dimensionId" = ANY($1::text[])',
        [dimensionIds]
      );
      const entityScoreCount = Number(entityRows.rows[0]?.count || 0);
      if (entityScoreCount === 0) {
        return null;
      }

      return { objectIds, objectScoreCount, entityScoreCount };
    },
    STARTUP_TIMEOUT_MS
  );
}

async function verifyScoreConstraints(db) {
  const token = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const dimensionId = `dim_${token}`;
  const objectId = `obj_${token}`;
  const entityId = `ent_${token}`;
  await db.query('BEGIN');
  try {
    await db.query(
      'INSERT INTO "dimensions" ("id","name","prompt","provider","model","isActive","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW())',
      [dimensionId, `dim-${token}`, 'prompt', 'openai', 'gpt-4o-mini', true]
    );
    await db.query(
      'INSERT INTO "research_objects" ("id","externalId","source","title","abstract","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,NOW(),NOW())',
      [objectId, `https://openalex.org/W${token}`, 'openalex', 'Title', 'Abstract']
    );
    await db.query(
      'INSERT INTO "entities" ("id","kind","name","externalId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,NOW(),NOW())',
      [entityId, 'author', 'Author', `https://openalex.org/A${token}`]
    );

    let objectCheckFailed = false;
    try {
      await db.query(
        'INSERT INTO "object_scores" ("dimensionId","objectId","value","explanation") VALUES ($1,$2,$3,$4)',
        [dimensionId, objectId, -1, 'invalid']
      );
    } catch {
      objectCheckFailed = true;
    }
    assert(objectCheckFailed, 'Expected object_scores value-range check to reject -1.');

    let entityCheckFailed = false;
    try {
      await db.query(
        'INSERT INTO "entity_scores" ("dimensionId","entityId","value","explanation") VALUES ($1,$2,$3,$4)',
        [dimensionId, entityId, 101, 'invalid']
      );
    } catch {
      entityCheckFailed = true;
    }
    assert(entityCheckFailed, 'Expected entity_scores value-range check to reject 101.');
  } finally {
    await db.query('ROLLBACK');
  }
}

async function runRuntimeSmoke(root, runtimeEnv) {
  const apiPort = await findFreePort();
  const mockPort = await findFreePort();
  const token = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const mock = createOpenAlexMockServer(createOpenAlexMockWorks(token, true));
  await new Promise((resolve) => mock.server.listen(mockPort, '127.0.0.1', resolve));
  const trpcPath = runtimeEnv.TRPC_PATH || '/trpc';
  const baseUrl = `http://localhost:${apiPort}`;

  const smokeEnv = {
    ...runtimeEnv,
    API_PORT: String(apiPort),
    OPENALEX_BASE_URL: `http://127.0.0.1:${mockPort}`,
    OPENALEX_API_KEY: runtimeEnv.OPENALEX_API_KEY || 'local-openalex-key',
  };

  const api = createProcess(root, 'npm', ['run', 'dev:api'], smokeEnv, 'api-s1_3');
  const jobs = createProcess(root, 'npm', ['run', 'dev:jobs'], smokeEnv, 'jobs-s1_3');
  const db = new Client({ connectionString: runtimeEnv.DATABASE_URL });
  try {
    await waitForHealthyApi(baseUrl, STARTUP_TIMEOUT_MS);
    await waitForJobsReady(jobs, STARTUP_TIMEOUT_MS);

    const openAiUpsert = await trpcMutation(baseUrl, trpcPath, 'apiKeys.upsert', {
      provider: 'openai',
      apiKey: runtimeEnv.OPENAI_API_KEY,
    });
    assert(openAiUpsert && !openAiUpsert.error, 'apiKeys.upsert for OpenAI failed.');

    const anthropicUpsert = await trpcMutation(baseUrl, trpcPath, 'apiKeys.upsert', {
      provider: 'anthropic',
      apiKey: runtimeEnv.ANTHROPIC_API_KEY,
    });
    assert(anthropicUpsert && !anthropicUpsert.error, 'apiKeys.upsert for Anthropic failed.');

    const providers = await trpcQuery(baseUrl, trpcPath, 'apiKeys.listProviders', {});
    assert(Array.isArray(providers), 'apiKeys.listProviders did not return array.');
    const configuredProviders = providers.filter((entry) => entry.status === 'configured');
    assert(configuredProviders.length === 2, 'Expected both providers configured for S1.3 smoke.');

    const openAiDimension = await trpcMutation(baseUrl, trpcPath, 'dimensions.create', {
      name: 'S1.3 OpenAI quality',
      prompt: 'Score technical relevance for transfer potential.',
      provider: 'openai',
      model: runtimeEnv.OPENAI_SMOKE_MODEL,
    });
    assert(openAiDimension && !openAiDimension.error, 'dimensions.create OpenAI failed.');

    const anthropicDimension = await trpcMutation(baseUrl, trpcPath, 'dimensions.create', {
      name: 'S1.3 Anthropic quality',
      prompt: 'Score implementation readiness and novelty.',
      provider: 'anthropic',
      model: runtimeEnv.ANTHROPIC_SMOKE_MODEL,
    });
    assert(anthropicDimension && !anthropicDimension.error, 'dimensions.create Anthropic failed.');

    const createdStream = await trpcMutation(baseUrl, trpcPath, 'streams.create', {
      name: 'S1.3 scoring smoke stream',
      query: 'search:scoring chain',
      maxObjects: 2,
    });
    assert(createdStream && !createdStream.error, 'streams.create failed for S1.3 smoke.');

    const triggered = await trpcMutation(baseUrl, trpcPath, 'streams.trigger', {
      id: createdStream.id,
    });
    assert(triggered && !triggered.error, 'streams.trigger failed for S1.3 smoke.');
    const terminalRun = await waitForRunTerminal(
      baseUrl,
      trpcPath,
      createdStream.id,
      triggered.id,
      STARTUP_TIMEOUT_MS,
      10
    );
    assert(terminalRun.status === 'succeeded', `S1.3 stream run failed: ${terminalRun.failureReason || 'unknown'}`);

    await db.connect();
    await waitForScoringEvidence(
      db,
      [openAiDimension.id, anthropicDimension.id],
      mock.externalIds
    );

    const backfill = await trpcMutation(baseUrl, trpcPath, 'scores.backfillDimension', {
      dimensionId: openAiDimension.id,
    });
    assert(backfill && !backfill.error, 'scores.backfillDimension failed.');
    assert(backfill.status === 'queued', 'Expected backfill kickoff status=queued.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${formatLogs(api)}${formatLogs(jobs)}`);
  } finally {
    await stopProcess(api, SHUTDOWN_TIMEOUT_MS);
    await stopProcess(jobs, SHUTDOWN_TIMEOUT_MS);
    await db.end().catch(() => undefined);
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
    SECRETS_MASTER_KEY: '',
    OPENAI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    OPENAI_SMOKE_MODEL: 'gpt-4o-mini',
    ANTHROPIC_SMOKE_MODEL: 'claude-3-5-haiku-latest',
  });

  process.env.DATABASE_URL = runtimeEnv.DATABASE_URL;
  runWorkspaceChecks(REQUIRED_WORKSPACES, 'verify-s1_3');
  runCommand('bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy', {
    context: 'verify-s1_3:migrate',
  });
  const db = new Client({ connectionString: runtimeEnv.DATABASE_URL });
  await db.connect();
  try {
    await verifyScoreConstraints(db);
  } finally {
    await db.end();
  }

  if (mode === 'runtime') {
    runtimeEnv.SECRETS_MASTER_KEY = requireRuntimeSecret(
      'SECRETS_MASTER_KEY',
      runtimeEnv.SECRETS_MASTER_KEY
    );
    runtimeEnv.OPENAI_API_KEY = requireRuntimeSecret('OPENAI_API_KEY', runtimeEnv.OPENAI_API_KEY);
    runtimeEnv.ANTHROPIC_API_KEY = requireRuntimeSecret(
      'ANTHROPIC_API_KEY',
      runtimeEnv.ANTHROPIC_API_KEY
    );
    runtimeEnv.OPENAI_SMOKE_MODEL = requireRuntimeSecret(
      'OPENAI_SMOKE_MODEL',
      runtimeEnv.OPENAI_SMOKE_MODEL
    );
    runtimeEnv.ANTHROPIC_SMOKE_MODEL = requireRuntimeSecret(
      'ANTHROPIC_SMOKE_MODEL',
      runtimeEnv.ANTHROPIC_SMOKE_MODEL
    );
    await runRuntimeSmoke(root, runtimeEnv);
  }

  console.log(`[verify-s1_3] passed (mode=${mode}).`);
}

main().catch((error) => {
  console.error(`[verify-s1_3] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
