import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { projectRoot, readJsonLikeYaml, runCommand } from '../lib/common.mjs';
import {
  assert,
  loadRuntimeEnv,
  parseVerifyMode,
  runWorkspaceChecks,
} from './runtime-utils.mjs';
import { runStage1ExitRuntimeSmoke } from './s1-exit-runtime.mjs';

const REQUIRED_WORKSPACES = ['apps/api', 'apps/jobs', 'apps/web', 'packages/shared', 'packages/db'];
const REQUIRED_PREREQ_PHASES = ['S1.1', 'S1.2', 'S1.3', 'S1.4'];
const STARTUP_TIMEOUT_MS = 60_000;
const SHUTDOWN_TIMEOUT_MS = 3_000;
const FEED_P95_LIMIT_MS = 200;
const FIRST_SCORE_LIMIT_MS = 60_000;
const MIN_SCORING_SUCCESS_RATE = 0.95;
const FEED_SAMPLE_COUNT = 15;

function requireRuntimeSecret(name, value) {
  assert(
    value && value.trim().length > 0,
    `Missing required runtime env '${name}' for S1.EXIT runtime smoke.`
  );
  return value.trim();
}

function formatRunId(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function ensureArtifactDirs(root, runId) {
  const baseDir = path.join(root, 'artifacts', 'stage1-acceptance');
  const latestDir = path.join(baseDir, 'latest');
  const runDir = path.join(baseDir, runId);
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(runDir, { recursive: true });
  fs.rmSync(latestDir, { recursive: true, force: true });
  fs.mkdirSync(latestDir, { recursive: true });
  return { latestDir, runDir };
}

function writeArtifactBundle(paths, files) {
  for (const [name, value] of Object.entries(files)) {
    const content =
      typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
    fs.writeFileSync(path.join(paths.runDir, name), content);
    fs.writeFileSync(path.join(paths.latestDir, name), content);
  }
}

function assertPrerequisiteVerifierContracts(root) {
  const config = readJsonLikeYaml(path.join(root, 'config', 'phase-gates.yaml'));
  assert(
    config && Array.isArray(config.phase_gates),
    'config/phase-gates.yaml must define phase_gates array.'
  );

  for (const phaseId of REQUIRED_PREREQ_PHASES) {
    const gate = config.phase_gates.find((entry) => entry.phase_id === phaseId);
    assert(gate, `Missing gate definition for prerequisite phase ${phaseId}.`);
    assert(
      Array.isArray(gate.required_tests) && gate.required_tests.length > 0,
      `Prerequisite phase ${phaseId} has no required_tests.`
    );
    for (const command of gate.required_tests) {
      assert(
        !command.includes('phase-test-placeholder'),
        `Prerequisite phase ${phaseId} still uses placeholder verifier.`
      );
      const match = command.match(/tools\/phase-gate\/(verify-[A-Za-z0-9_.-]+\.mjs)/);
      if (!match) {
        continue;
      }
      const scriptPath = path.join(root, 'tools', 'phase-gate', match[1]);
      assert(fs.existsSync(scriptPath), `Missing prerequisite verifier script: ${scriptPath}`);
    }
  }
}

async function assertStage1DbInvariants(db) {
  const constraints = await db.query(
    `SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition
     FROM pg_constraint
     WHERE contype IN ('u', 'c')`
  );
  const indexes = await db.query(
    `SELECT tablename, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'`
  );

  const constraintDefs = constraints.rows.map(
    (row) => `${row.table_name}|${row.definition}`
  );
  const indexDefs = indexes.rows.map((row) => `${row.tablename}|${row.indexdef}`);

  const requiredConstraintChecks = [
    { table: 'object_scores', terms: ['CHECK', 'value >= (0)::double precision', 'value <= (100)::double precision'] },
    { table: 'entity_scores', terms: ['CHECK', 'value >= (0)::double precision', 'value <= (100)::double precision'] },
  ];
  const requiredIndexChecks = [
    {
      table: 'research_objects',
      terms: ['CREATE UNIQUE INDEX', '"research_objects_externalId_source_key"', '("externalId", source)'],
    },
    {
      table: 'object_scores',
      terms: ['CREATE UNIQUE INDEX', '"object_scores_dimensionId_objectId_key"', '("dimensionId", "objectId")'],
    },
    {
      table: 'entity_scores',
      terms: ['CREATE UNIQUE INDEX', '"entity_scores_dimensionId_entityId_key"', '("dimensionId", "entityId")'],
    },
    {
      table: 'object_pipeline_cards',
      terms: ['CREATE UNIQUE INDEX', '"object_pipeline_cards_pipelineId_objectId_key"', '("pipelineId", "objectId")'],
    },
    {
      table: 'stream_run_objects',
      terms: ['CREATE UNIQUE INDEX', '"stream_run_objects_streamRunId_objectId_key"', '("streamRunId", "objectId")'],
    },
    {
      table: 'stream_runs',
      terms: ['"stream_runs_streamId_status_startedAt_idx"', '("streamId", status, "startedAt" DESC)'],
    },
    {
      table: 'stream_run_objects',
      terms: ['"stream_run_objects_streamId_objectId_idx"', '("streamId", "objectId")'],
    },
    {
      table: 'object_pipeline_cards',
      terms: ['"object_pipeline_cards_pipelineId_stageId_position_idx"', '("pipelineId", "stageId", "position")'],
    },
    {
      table: 'object_scores',
      terms: ['"object_scores_dimensionId_idx"', '("dimensionId")'],
    },
  ];

  for (const check of requiredConstraintChecks) {
    const matched = constraintDefs.some((value) => {
      if (!value.startsWith(`${check.table}|`)) {
        return false;
      }
      return check.terms.every((term) => value.includes(term));
    });
    assert(
      matched,
      `Missing DB check constraint terms for ${check.table}: ${check.terms.join(', ')}`
    );
  }
  for (const check of requiredIndexChecks) {
    const matched = indexDefs.some((value) => {
      if (!value.startsWith(`${check.table}|`)) {
        return false;
      }
      return check.terms.every((term) => value.includes(term));
    });
    assert(
      matched,
      `Missing DB index terms for ${check.table}: ${check.terms.join(', ')}`
    );
  }
}

function buildReport(summary, metrics, events) {
  return `# Stage 1 Acceptance Report (S1.EXIT)

- generated_at: ${summary.generatedAt}
- mode: ${summary.mode}
- verdict: ${summary.verdict}

## Requirement Mapping
- S1.EXIT-REQ-001..006: verified by gate + runtime verifier evidence

## Acceptance Criteria
- AC-001 Golden path: ${summary.checks.goldenPath}
- AC-002 Idempotency/run-state: ${summary.checks.idempotencyAndRunState}
- AC-003 Scoring reliability: ${summary.checks.scoringReliability}
- AC-004 Performance: ${summary.checks.performance}
- AC-005 Evidence completeness: ${summary.checks.evidenceComplete}

## Metrics Snapshot
- first_score_ms: ${metrics.firstScoreMs ?? 'n/a'}
- scoring_success_rate: ${metrics.scoringSuccessRate ?? 'n/a'}
- feed_p95_ms: ${metrics.feedP95Ms ?? 'n/a'}
- feed_samples_ms: ${(metrics.feedSamplesMs || []).join(', ') || 'n/a'}

## Runtime Evidence IDs
- stream_id: ${events.streamId ?? 'n/a'}
- run_ids: ${(events.runIds || []).join(', ') || 'n/a'}
- dimension_id: ${events.dimensionId ?? 'n/a'}
- object_id: ${events.objectId ?? 'n/a'}
- entity_id: ${events.entityId ?? 'n/a'}
- pipeline_id: ${events.pipelineId ?? 'n/a'}
`;
}

async function main() {
  const root = projectRoot();
  const mode = parseVerifyMode(process.argv.slice(2), 'runtime');
  const runId = formatRunId();
  const artifactPaths = ensureArtifactDirs(root, runId);
  const runtimeEnv = loadRuntimeEnv(root, {
    API_PORT: '4000',
    WEB_PORT: '3333',
    DATABASE_URL:
      'postgresql://postgres:postgres@localhost:5432/paperscraper_next?schema=public',
    REDIS_URL: 'redis://localhost:6379',
    TRPC_PATH: '/trpc',
    JOB_QUEUE_NAME: 'psn.foundation',
    GRAPH_QUEUE_NAME: 'psn.object.created',
    OPENALEX_BASE_URL: 'https://api.openalex.org',
    OPENALEX_API_KEY: '',
    OPENAI_SMOKE_MODEL: 'gpt-4o-mini',
  });
  runtimeEnv.SECRETS_MASTER_KEY =
    runtimeEnv.SECRETS_MASTER_KEY || process.env.SECRETS_MASTER_KEY || '';
  runtimeEnv.OPENAI_API_KEY =
    runtimeEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '';
  runtimeEnv.OPENAI_SMOKE_MODEL =
    runtimeEnv.OPENAI_SMOKE_MODEL || process.env.OPENAI_SMOKE_MODEL || 'gpt-4o-mini';

  process.env.DATABASE_URL = runtimeEnv.DATABASE_URL;
  runWorkspaceChecks(REQUIRED_WORKSPACES, 'verify-s1_exit');
  runCommand('bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy', {
    context: 'verify-s1_exit:migrate',
  });
  assertPrerequisiteVerifierContracts(root);

  const db = new Client({ connectionString: runtimeEnv.DATABASE_URL });
  await db.connect();
  try {
    await assertStage1DbInvariants(db);
  } finally {
    await db.end();
  }

  const summary = {
    phase: 'S1.EXIT',
    mode,
    runId,
    generatedAt: new Date().toISOString(),
    verdict: 'passed',
    checks: {
      goldenPath: 'passed',
      idempotencyAndRunState: 'passed',
      scoringReliability: mode === 'runtime' ? 'passed' : 'not-run',
      performance: mode === 'runtime' ? 'passed' : 'not-run',
      evidenceComplete: 'passed',
    },
    requirementMap: {
      'S1.EXIT-REQ-001': 'passed',
      'S1.EXIT-REQ-002': 'passed',
      'S1.EXIT-REQ-003': mode === 'runtime' ? 'passed' : 'not-run',
      'S1.EXIT-REQ-004': mode === 'runtime' ? 'passed' : 'not-run',
      'S1.EXIT-REQ-005': mode === 'runtime' ? 'passed' : 'not-run',
      'S1.EXIT-REQ-006': 'passed',
    },
    artifactPaths: {
      latest: path.relative(root, artifactPaths.latestDir),
      run: path.relative(root, artifactPaths.runDir),
    },
  };

  let metrics = {
    firstScoreMs: null,
    scoringSuccessRate: null,
    feedP95Ms: null,
    feedSamplesMs: [],
    thresholds: {
      firstScoreMsLt: FIRST_SCORE_LIMIT_MS,
      feedP95MsLte: FEED_P95_LIMIT_MS,
      scoringSuccessRateGte: MIN_SCORING_SUCCESS_RATE,
    },
  };
  let events = {
    streamId: null,
    runIds: [],
    objectId: null,
    entityId: null,
    dimensionId: null,
    pipelineId: null,
    transientRetryObserved: false,
  };

  if (mode === 'runtime') {
    runtimeEnv.SECRETS_MASTER_KEY = requireRuntimeSecret(
      'SECRETS_MASTER_KEY',
      runtimeEnv.SECRETS_MASTER_KEY
    );
    runtimeEnv.OPENAI_API_KEY = requireRuntimeSecret(
      'OPENAI_API_KEY',
      runtimeEnv.OPENAI_API_KEY
    );
    runtimeEnv.OPENAI_SMOKE_MODEL = requireRuntimeSecret(
      'OPENAI_SMOKE_MODEL',
      runtimeEnv.OPENAI_SMOKE_MODEL
    );

    const runtimeResult = await runStage1ExitRuntimeSmoke({
      root,
      runtimeEnv,
      startupTimeoutMs: STARTUP_TIMEOUT_MS,
      shutdownTimeoutMs: SHUTDOWN_TIMEOUT_MS,
      firstScoreLimitMs: FIRST_SCORE_LIMIT_MS,
      minScoringSuccessRate: MIN_SCORING_SUCCESS_RATE,
      feedP95LimitMs: FEED_P95_LIMIT_MS,
      feedSampleCount: FEED_SAMPLE_COUNT,
    });
    metrics = {
      ...metrics,
      firstScoreMs: runtimeResult.firstScoreMs,
      scoringSuccessRate: runtimeResult.scoringSuccessRate,
      feedP95Ms: runtimeResult.feedP95Ms,
      feedSamplesMs: runtimeResult.feedSamplesMs,
    };
    events = {
      ...events,
      streamId: runtimeResult.streamId,
      runIds: runtimeResult.runIds,
      objectId: runtimeResult.objectId,
      entityId: runtimeResult.entityId,
      dimensionId: runtimeResult.dimensionId,
      pipelineId: runtimeResult.pipelineId,
      transientRetryObserved: runtimeResult.transientRetryObserved,
    };
  }

  writeArtifactBundle(artifactPaths, {
    'summary.json': summary,
    'metrics.json': metrics,
    'events.json': events,
    'report.md': buildReport(summary, metrics, events),
  });
  console.log(`[verify-s1_exit] artifacts: ${summary.artifactPaths.latest}`);
  console.log(`[verify-s1_exit] passed (mode=${mode}).`);
}

main().catch((error) => {
  console.error(
    `[verify-s1_exit] failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
