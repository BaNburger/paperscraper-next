import { Client } from 'pg';
import {
  assert,
  createProcess,
  findFreePort,
  formatLogs,
  stopProcess,
  trpcMutation,
  trpcQuery,
  waitFor,
} from './runtime-utils.mjs';
import {
  createTransientOpenAlexMockServer,
  waitForHealthyApi,
  waitForJobsReady,
  waitForRunTerminal,
  waitForScoringMetrics,
} from './runtime-harness.mjs';

function parseJsonPlanRow(planValue) {
  if (Array.isArray(planValue)) return planValue[0] || null;
  if (typeof planValue === 'string') {
    const parsed = JSON.parse(planValue);
    return Array.isArray(parsed) ? parsed[0] || null : parsed;
  }
  return planValue;
}

function percentile(values, p) {
  assert(values.length > 0, 'Cannot compute percentile for empty sample set.');
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[rank];
}

async function queryFeedExecutionTimeMs(db, streamId) {
  const result = await db.query(
    `EXPLAIN (ANALYZE, FORMAT JSON)
     WITH score AS (
       SELECT os."objectId", MAX(os."value") AS "topScore"
       FROM "object_scores" os
       GROUP BY os."objectId"
     )
     SELECT
       ro."id",
       ro."title",
       score."topScore"
     FROM "research_objects" ro
     LEFT JOIN score ON score."objectId" = ro."id"
     WHERE EXISTS (
       SELECT 1
       FROM "stream_run_objects" sro
       WHERE sro."objectId" = ro."id"
         AND sro."streamId" = $1
     )
     ORDER BY COALESCE(score."topScore", -1) DESC, ro."id" DESC
     LIMIT 20`,
    [streamId]
  );

  const plan = parseJsonPlanRow(result.rows[0]?.['QUERY PLAN']);
  assert(
    plan && typeof plan['Execution Time'] === 'number',
    'Could not parse feed benchmark execution time.'
  );
  return Number(plan['Execution Time']);
}

async function benchmarkFeedP95(db, streamId, sampleCount) {
  await queryFeedExecutionTimeMs(db, streamId);
  const samples = [];
  for (let index = 0; index < sampleCount; index += 1) samples.push(await queryFeedExecutionTimeMs(db, streamId));
  return { samples, p95: percentile(samples, 95) };
}

export async function runStage1ExitRuntimeSmoke({
  root,
  runtimeEnv,
  startupTimeoutMs,
  shutdownTimeoutMs,
  firstScoreLimitMs,
  minScoringSuccessRate,
  feedP95LimitMs,
  feedSampleCount,
}) {
  const apiPort = await findFreePort();
  const webPort = await findFreePort();
  const mockPort = await findFreePort();
  const seed = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const openAlexMock = createTransientOpenAlexMockServer(seed, true);
  await new Promise((resolve) => openAlexMock.server.listen(mockPort, '127.0.0.1', resolve));

  const smokeEnv = {
    ...runtimeEnv,
    API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
    VITE_API_BASE_URL: `http://localhost:${apiPort}`,
    CORS_ALLOWED_ORIGINS: `http://localhost:${webPort}`,
    OPENALEX_BASE_URL: `http://127.0.0.1:${mockPort}`,
    OPENALEX_API_KEY: runtimeEnv.OPENALEX_API_KEY || 'local-openalex-key',
  };
  const baseUrl = `http://localhost:${apiPort}`;
  const trpcPath = runtimeEnv.TRPC_PATH || '/trpc';
  const api = createProcess(root, 'npm', ['run', 'dev:api'], smokeEnv, 'api-s1_exit');
  const jobs = createProcess(root, 'npm', ['run', 'dev:jobs'], smokeEnv, 'jobs-s1_exit');
  const web = createProcess(root, 'npm', ['run', 'dev:web'], smokeEnv, 'web-s1_exit');
  const db = new Client({ connectionString: runtimeEnv.DATABASE_URL });

  try {
    await waitForHealthyApi(baseUrl, startupTimeoutMs);
    await waitForJobsReady(jobs, startupTimeoutMs);
    await db.connect();

    const upsert = await trpcMutation(baseUrl, trpcPath, 'apiKeys.upsert', {
      provider: 'openai',
      apiKey: runtimeEnv.OPENAI_API_KEY,
    });
    assert(upsert && !upsert.error, 'apiKeys.upsert(openai) failed in S1.EXIT runtime.');

    const dimension = await trpcMutation(baseUrl, trpcPath, 'dimensions.create', {
      name: `S1.EXIT OpenAI Dimension ${seed}`,
      prompt: 'Score technology transfer readiness on a 0..100 scale.',
      provider: 'openai',
      model: runtimeEnv.OPENAI_SMOKE_MODEL,
    });
    assert(
      dimension && !dimension.error,
      'dimensions.create(openai) failed in S1.EXIT runtime.'
    );

    const stream = await trpcMutation(baseUrl, trpcPath, 'streams.create', {
      name: `S1.EXIT stream ${seed}`,
      query: 'search:technology transfer',
      maxObjects: 5,
    });
    assert(stream && !stream.error, 'streams.create failed in S1.EXIT runtime.');

    const triggerStartedMs = Date.now();
    const runOne = await trpcMutation(baseUrl, trpcPath, 'streams.trigger', { id: stream.id });
    assert(runOne && !runOne.error, 'streams.trigger(run1) failed in S1.EXIT runtime.');
    const terminalOne = await waitForRunTerminal(
      baseUrl,
      trpcPath,
      stream.id,
      runOne.id,
      startupTimeoutMs,
      10
    );
    assert(terminalOne.status === 'succeeded', `run1 failed: ${terminalOne.failureReason || 'unknown'}`);

    const scoringMetrics = await waitForScoringMetrics(
      db,
      runOne.id,
      dimension.id,
      startupTimeoutMs
    );
    // Timestamp columns are timezone-naive in PostgreSQL; use trigger-to-observation elapsed time.
    const firstScoreMs = Date.now() - triggerStartedMs;
    assert(
      firstScoreMs >= 0 && firstScoreMs < firstScoreLimitMs,
      `First-score latency ${firstScoreMs}ms exceeds ${firstScoreLimitMs}ms.`
    );
    const scoringCompletion = await waitFor(
      'scoring success threshold',
      async () => {
        const rows = await db.query(
          `SELECT
             COUNT(*)::int AS "objectCount",
             COUNT(os."id")::int AS "scoredCount"
           FROM "stream_run_objects" sro
           LEFT JOIN "object_scores" os
             ON os."objectId" = sro."objectId"
            AND os."dimensionId" = $2
           WHERE sro."streamRunId" = $1`,
          [runOne.id, dimension.id]
        );
        const objectCount = Number(rows.rows[0]?.objectCount || 0);
        const scoredCount = Number(rows.rows[0]?.scoredCount || 0);
        if (objectCount === 0) {
          return null;
        }
        const ratio = scoredCount / objectCount;
        return ratio >= minScoringSuccessRate ? { objectCount, scoredCount, ratio } : null;
      },
      startupTimeoutMs
    );
    const scoringSuccessRate = scoringCompletion.ratio;
    assert(
      scoringSuccessRate >= minScoringSuccessRate,
      `Scoring success rate ${scoringSuccessRate.toFixed(4)} is below ${minScoringSuccessRate}.`
    );

    const feed = await trpcQuery(baseUrl, trpcPath, 'objects.feed', {
      sortBy: 'topScore',
      streamId: stream.id,
      limit: 20,
    });
    assert(
      feed && !feed.error && Array.isArray(feed.items) && feed.items.length > 0,
      'objects.feed continuity failed.'
    );
    const objectId = feed.items[0].id;

    const objectDetail = await trpcQuery(baseUrl, trpcPath, 'objects.detail', { objectId });
    assert(objectDetail && !objectDetail.error, 'objects.detail continuity failed.');
    assert(
      Array.isArray(objectDetail.entities) && objectDetail.entities.length > 0,
      'objects.detail returned no entities.'
    );

    const entityId = objectDetail.entities[0].entityId;
    const entityDetail = await trpcQuery(baseUrl, trpcPath, 'entities.detail', { entityId });
    assert(entityDetail && !entityDetail.error, 'entities.detail continuity failed.');

    const board = await trpcQuery(baseUrl, trpcPath, 'pipelines.getBoard', {});
    assert(board && !board.error, 'pipelines.getBoard continuity failed.');
    assert(
      Array.isArray(board.stages) && board.stages.length >= 2,
      'Expected at least two board stages.'
    );
    const added = await trpcMutation(baseUrl, trpcPath, 'pipelines.addCard', {
      pipelineId: board.pipeline.id,
      stageId: board.stages[0].id,
      objectId,
    });
    assert(added && !added.error, 'pipelines.addCard continuity failed.');
    const addedCard = added.stages
      .flatMap((stage) => stage.cards)
      .find((card) => card.objectId === objectId);
    assert(addedCard, 'Added card not present on board.');
    const moved = await trpcMutation(baseUrl, trpcPath, 'pipelines.moveCard', {
      pipelineId: board.pipeline.id,
      cardId: addedCard.id,
      toStageId: board.stages[1].id,
      toPosition: 0,
    });
    assert(moved && !moved.error, 'pipelines.moveCard continuity failed.');
    const removed = await trpcMutation(baseUrl, trpcPath, 'pipelines.removeCard', {
      pipelineId: board.pipeline.id,
      cardId: addedCard.id,
    });
    assert(removed && !removed.error, 'pipelines.removeCard continuity failed.');

    const runTwo = await trpcMutation(baseUrl, trpcPath, 'streams.trigger', { id: stream.id });
    assert(runTwo && !runTwo.error, 'streams.trigger(run2) failed in S1.EXIT runtime.');
    const terminalTwo = await waitForRunTerminal(
      baseUrl,
      trpcPath,
      stream.id,
      runTwo.id,
      startupTimeoutMs,
      10
    );
    assert(terminalTwo.status === 'succeeded', `run2 failed: ${terminalTwo.failureReason || 'unknown'}`);
    assert(terminalTwo.insertedCount === 0, 'Idempotency regression: run2 inserted objects.');

    const runThree = await trpcMutation(baseUrl, trpcPath, 'streams.trigger', { id: stream.id });
    const runFour = await trpcMutation(baseUrl, trpcPath, 'streams.trigger', { id: stream.id });
    assert(runThree && !runThree.error, 'streams.trigger(run3) failed.');
    assert(runFour && !runFour.error, 'streams.trigger(run4) failed.');

    let overlapDetected = false;
    const terminalFour = await waitFor(
      'run4 terminal + overlap check',
      async () => {
        const runs = await trpcQuery(baseUrl, trpcPath, 'streams.runs', { streamId: stream.id, limit: 10 });
        if (!Array.isArray(runs)) {
          return null;
        }
        const runningCount = runs.filter((run) => run.status === 'running').length;
        if (runningCount > 1) {
          overlapDetected = true;
        }
        return runs.find((run) => run.id === runFour.id && ['succeeded', 'failed'].includes(run.status)) || null;
      },
      startupTimeoutMs
    );
    assert(!overlapDetected, 'Queue-behind regression: overlapping running stream runs detected.');
    assert(terminalFour.status === 'succeeded', `run4 failed: ${terminalFour.failureReason || 'unknown'}`);

    const terminalThree = await waitForRunTerminal(
      baseUrl,
      trpcPath,
      stream.id,
      runThree.id,
      startupTimeoutMs,
      10
    );
    const runsAfter = await trpcQuery(baseUrl, trpcPath, 'streams.runs', { streamId: stream.id, limit: 10 });
    assert(Array.isArray(runsAfter), 'streams.runs unavailable for queue-behind validation.');
    const runThreeRow = runsAfter.find((item) => item.id === runThree.id);
    const runFourRow = runsAfter.find((item) => item.id === runFour.id);
    assert(runThreeRow && runFourRow, 'Missing run rows for queue-behind validation.');
    assert(terminalThree.status === 'succeeded', `run3 failed: ${terminalThree.failureReason || 'unknown'}`);
    assert(
      new Date(runFourRow.startedAt).getTime() >=
        new Date(runThreeRow.finishedAt || runThreeRow.startedAt).getTime(),
      'Queue-behind regression: run4 started before run3 reached terminal.'
    );

    const degradedEvidence = jobs.jsonLogs.find(
      (entry) =>
        entry &&
        entry.component === 'jobs-worker' &&
        entry.state === 'degraded' &&
        typeof entry.reason === 'string' &&
        entry.reason.includes('OpenAlex request failed with status 503')
    );
    assert(openAlexMock.didInjectTransient(), 'Transient OpenAlex failure was not injected.');
    assert(
      degradedEvidence,
      'Missing degraded retry observability log after transient OpenAlex failure.'
    );
    assert(jobs.processHandle.exitCode === null, 'Jobs worker exited unexpectedly after transient failure.');

    const feedPerf = await benchmarkFeedP95(db, stream.id, feedSampleCount);
    assert(
      feedPerf.p95 <= feedP95LimitMs,
      `Feed benchmark p95 ${feedPerf.p95}ms exceeds ${feedP95LimitMs}ms.`
    );

    return {
      streamId: stream.id,
      runIds: [runOne.id, runTwo.id, runThree.id, runFour.id],
      objectId,
      entityId,
      dimensionId: dimension.id,
      pipelineId: board.pipeline.id,
      firstScoreMs,
      scoringSuccessRate,
      feedSamplesMs: feedPerf.samples,
      feedP95Ms: feedPerf.p95,
      transientRetryObserved: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${formatLogs(api)}${formatLogs(jobs)}${formatLogs(web)}`);
  } finally {
    await stopProcess(api, shutdownTimeoutMs);
    await stopProcess(jobs, shutdownTimeoutMs);
    await stopProcess(web, shutdownTimeoutMs);
    await db.end().catch(() => undefined);
    await new Promise((resolve) => openAlexMock.server.close(() => resolve()));
  }
}
