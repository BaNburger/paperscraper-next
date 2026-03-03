import { chromium } from 'playwright';
import { projectRoot, runCommand } from '../lib/common.mjs';
import {
  assert,
  createProcess,
  findFreePort,
  formatLogs,
  loadRuntimeEnv,
  parseVerifyMode,
  stopProcess,
  trpcMutation,
  trpcQuery,
} from './runtime-utils.mjs';
import {
  createOpenAlexMockServer,
  createOpenAlexMockWorks,
  waitForHealthyApi,
  waitForJobsReady,
  waitForRunTerminal,
} from './runtime-harness.mjs';

const STARTUP_TIMEOUT_MS = 45_000;
const SHUTDOWN_TIMEOUT_MS = 3_000;
const ZERO_KEY_BASE64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

async function runRuntimeUiSmoke(root, runtimeEnv) {
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
    CORS_ALLOWED_ORIGINS: `http://localhost:${webPort}`,
    OPENALEX_BASE_URL: `http://127.0.0.1:${mockPort}`,
    OPENALEX_API_KEY: runtimeEnv.OPENALEX_API_KEY || 'local-openalex-key',
    SECRETS_MASTER_KEY: runtimeEnv.SECRETS_MASTER_KEY || ZERO_KEY_BASE64,
  };
  const baseUrl = `http://localhost:${apiPort}`;
  const webBaseUrl = `http://localhost:${webPort}`;
  const trpcPath = runtimeEnv.TRPC_PATH || '/trpc';

  const api = createProcess(root, 'npm', ['run', 'dev:api'], smokeEnv, 'api-s1_4_ui');
  const jobs = createProcess(root, 'npm', ['run', 'dev:jobs'], smokeEnv, 'jobs-s1_4_ui');
  const web = createProcess(root, 'npm', ['run', 'dev:web'], smokeEnv, 'web-s1_4_ui');

  let browser;
  try {
    await waitForHealthyApi(baseUrl, STARTUP_TIMEOUT_MS);
    await waitForJobsReady(jobs, STARTUP_TIMEOUT_MS);

    const createdStream = await trpcMutation(baseUrl, trpcPath, 'streams.create', {
      name: 'S1.4 UI smoke stream',
      query: 'search:frontend pipeline',
      maxObjects: 2,
    });
    assert(createdStream && !createdStream.error, 'streams.create failed for UI smoke.');

    const run = await trpcMutation(baseUrl, trpcPath, 'streams.trigger', {
      id: createdStream.id,
    });
    assert(run && !run.error, 'streams.trigger failed for UI smoke.');

    const terminalRun = await waitForRunTerminal(
      baseUrl,
      trpcPath,
      createdStream.id,
      run.id,
      STARTUP_TIMEOUT_MS,
      10
    );
    assert(terminalRun.status === 'succeeded', 'UI smoke stream run failed.');

    const feed = await trpcQuery(baseUrl, trpcPath, 'objects.feed', {
      sortBy: 'topScore',
      streamId: createdStream.id,
      limit: 20,
    });
    assert(feed && !feed.error && Array.isArray(feed.items), 'objects.feed failed in UI smoke.');
    assert(feed.items.length > 0, 'UI smoke requires at least one feed item.');
    const firstObjectId = feed.items[0].id;

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(`${webBaseUrl}/feed`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="feed-screen"]');
    await page.waitForFunction(
      (streamId) => {
        const select = document.querySelector('[data-testid="feed-filter-stream"]');
        if (!(select instanceof HTMLSelectElement)) {
          return false;
        }
        return Array.from(select.options).some((option) => option.value === streamId);
      },
      createdStream.id
    );
    await page.selectOption('[data-testid="feed-filter-stream"]', createdStream.id);
    await page.click('[data-testid="feed-apply"]');
    const hasObjectCard = await page
      .locator('.object-card')
      .first()
      .isVisible({ timeout: 6_000 })
      .catch(() => false);
    if (hasObjectCard) {
      await page.click('.object-card button');
      await page.waitForTimeout(300);
    } else {
      await page.waitForSelector('.state');
    }

    await page.waitForSelector('[data-testid="feed-api-keys-pane"]');
    await page.fill('[data-testid="api-key-input"]', 'sk-local-ui-smoke');
    await page.click('[data-testid="api-key-save"]');
    await page.waitForTimeout(500);

    await page.waitForSelector('[data-testid="feed-streams-pane"]');
    await page.fill('input[name="name"]', 'UI smoke stream 2');
    await page.fill('input[name="query"]', 'search:ui smoke');
    await page.fill('input[name="maxObjects"]', '2');
    await page.click('[data-testid="stream-create"]');
    await page.waitForTimeout(500);

    await page.goto(`${webBaseUrl}/objects/${firstObjectId}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('[data-testid="object-detail-screen"]');

    const entityLink = page.locator('[data-testid="object-detail-screen"] a').first();
    if (await entityLink.count()) {
      await entityLink.click({ force: true });
      await page.waitForSelector('[data-testid="entity-detail-screen"]');
    }

    await page.goto(`${webBaseUrl}/pipeline`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="pipeline-screen"]');
    const editorVisible = await page
      .locator('[data-testid="pipeline-add-object-id"]')
      .isVisible({ timeout: 6_000 })
      .catch(() => false);
    if (editorVisible) {
      await page.fill('[data-testid="pipeline-add-object-id"]', firstObjectId);
      await page.click('[data-testid="pipeline-add-card"]');
      await page.waitForSelector('.board-card');

      const source = page.locator('.board-card .drag-handle').first();
      const target = page.locator('.board-column').nth(1);
      if ((await source.count()) > 0 && (await target.count()) > 0) {
        await source.dragTo(target);
        await page.waitForTimeout(300);
      }

      const removeButton = page.locator('button:has-text("Remove")').first();
      if (await removeButton.count()) {
        await removeButton.click();
        await page.waitForTimeout(300);
      }
    } else {
      await page.waitForSelector('.state');
    }

    await page.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}${formatLogs(api)}${formatLogs(jobs)}${formatLogs(web)}`);
  } finally {
    if (browser) {
      await browser.close();
    }
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
    SECRETS_MASTER_KEY: ZERO_KEY_BASE64,
  });

  process.env.DATABASE_URL = runtimeEnv.DATABASE_URL;
  runCommand('bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy', {
    context: 'verify-s1_4_ui:migrate',
  });

  if (mode === 'runtime') {
    await runRuntimeUiSmoke(root, runtimeEnv);
  }

  console.log(`[verify-s1_4_ui] passed (mode=${mode}).`);
}

main().catch((error) => {
  console.error(`[verify-s1_4_ui] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
