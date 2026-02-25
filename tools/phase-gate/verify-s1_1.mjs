import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { projectRoot, runCommand } from '../lib/common.mjs';

const STARTUP_TIMEOUT_MS = 20000;
const POLL_INTERVAL_MS = 250;
const SHUTDOWN_TIMEOUT_MS = 3000;
const root = projectRoot();
const REQUIRED_WORKSPACES = ['apps/api', 'apps/jobs', 'apps/web', 'packages/shared', 'packages/db'];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const env = {};
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separator = line.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    env[key] = value;
  }
  return env;
}

function loadRuntimeEnv() {
  const exampleEnv = readEnvFile(path.join(root, '.env.example'));
  const localEnv = readEnvFile(path.join(root, '.env'));
  const runtimeEnv = {
    ...process.env,
    ...exampleEnv,
    ...localEnv,
  };
  runtimeEnv.API_PORT = runtimeEnv.API_PORT || '4000';
  runtimeEnv.DATABASE_URL =
    runtimeEnv.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/paperscraper_next?schema=public';
  runtimeEnv.REDIS_URL = runtimeEnv.REDIS_URL || 'redis://localhost:6379';
  runtimeEnv.TRPC_PATH = runtimeEnv.TRPC_PATH || '/trpc';
  return runtimeEnv;
}

function runWorkspaceChecks() {
  for (const workspace of REQUIRED_WORKSPACES) {
    runCommand(`npm --prefix ${workspace} run lint --if-present`, { context: `verify-s1_1:lint:${workspace}` });
    runCommand(`npm --prefix ${workspace} run test --if-present`, { context: `verify-s1_1:test:${workspace}` });
  }
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not determine a free port.'));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function createProcess(command, args, env, name) {
  const logs = [];
  const jsonLogs = [];
  const processHandle = spawn(command, args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const capture = (stream, channel) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      while (true) {
        const newline = buffer.indexOf('\n');
        if (newline < 0) {
          break;
        }

        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) {
          continue;
        }
        logs.push(`[${channel}] ${line}`);
        try {
          jsonLogs.push(JSON.parse(line));
        } catch {
          // Non-JSON lines are expected from npm/bun wrappers.
        }
      }
    });
  };

  capture(processHandle.stdout, 'stdout');
  capture(processHandle.stderr, 'stderr');
  processHandle.on('exit', (code) => {
    if (code !== null && code !== 0) {
      logs.push(`[exit] process '${name}' exited with code ${code}`);
    }
  });

  return { name, processHandle, logs, jsonLogs };
}

async function stopProcess(handle) {
  if (!handle || handle.processHandle.exitCode !== null) {
    return;
  }
  await new Promise((resolve) => {
    let finished = false;
    const pid = handle.processHandle.pid || 0;
    const finish = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };

    const timeout = setTimeout(() => {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        handle.processHandle.kill('SIGKILL');
      }
    }, SHUTDOWN_TIMEOUT_MS);

    const forceResolve = setTimeout(() => {
      clearTimeout(timeout);
      finish();
    }, SHUTDOWN_TIMEOUT_MS + 1000);
    handle.processHandle.once('exit', () => {
      clearTimeout(timeout);
      clearTimeout(forceResolve);
      finish();
    });

    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      handle.processHandle.kill('SIGTERM');
    }
  });
}

async function waitFor(description, fn, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await fn();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(`Timeout waiting for ${description}.`);
}

function requestJson(url) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(
      target,
      { method: 'GET', timeout: 2000 },
      (response) => {
        if ((response.statusCode || 500) >= 400) {
          resolve(null);
          response.resume();
          return;
        }
        let body = '';
        response.on('data', (chunk) => {
          body += chunk.toString();
        });
        response.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      }
    );
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
    request.on('error', () => {
      resolve(null);
    });
    request.end();
  });
}

function formatLogs(handle) {
  if (!handle) {
    return '';
  }
  const lastLines = handle.logs.slice(-20).join('\n');
  return lastLines ? `\nRecent logs from ${handle.name}:\n${lastLines}` : '';
}

function findJobsReadinessLog(jsonLogs) {
  return jsonLogs.find(
    (entry) =>
      entry &&
      entry.component === 'jobs-worker' &&
      ['ready', 'degraded', 'failed'].includes(entry.state)
  );
}

async function runRuntimeSmoke(runtimeEnv) {
  const apiPort = await findFreePort();
  const smokeApiEnv = {
    ...runtimeEnv,
    API_PORT: String(apiPort),
  };
  const healthUrl = `http://localhost:${apiPort}/health`;
  const trpcUrl = `http://localhost:${apiPort}${smokeApiEnv.TRPC_PATH}/system.health?input=%7B%7D`;
  const api = createProcess('npm', ['run', 'dev:api'], smokeApiEnv, 'api');
  const jobs = createProcess('npm', ['run', 'dev:jobs'], runtimeEnv, 'jobs');
  let degradedApi = null;
  try {
    const health = await waitFor(
      'healthy API',
      async () => {
        const payload = await requestJson(healthUrl);
        if (!payload) {
          return null;
        }
        return payload.status === 'ok' ? payload : null;
      },
      STARTUP_TIMEOUT_MS
    );
    assert(health.dependencies?.postgres?.status === 'ready', 'Expected postgres dependency to be ready.');
    assert(health.dependencies?.redis?.status === 'ready', 'Expected redis dependency to be ready.');
    const trpc = await waitFor(
      'tRPC system health',
      async () => {
        const payload = await requestJson(trpcUrl);
        if (!payload) {
          return null;
        }
        return payload.result?.data ? payload : null;
      },
      STARTUP_TIMEOUT_MS
    );
    assert(trpc.result.data.status === 'ok', 'Expected tRPC system.health to report status ok.');
    const jobsReadiness = await waitFor(
      'jobs readiness log',
      async () => findJobsReadinessLog(jobs.jsonLogs),
      STARTUP_TIMEOUT_MS
    );
    assert(jobsReadiness.state === 'ready', `Expected jobs readiness state to be ready, got ${jobsReadiness.state}.`);
    await stopProcess(api);
    const degradedEnv = {
      ...smokeApiEnv,
      API_PORT: String(apiPort),
      REDIS_URL: 'redis://127.0.0.1:6399',
    };
    degradedApi = createProcess('npm', ['run', 'dev:api'], degradedEnv, 'api-degraded');
    const degradedHealth = await waitFor(
      'degraded API health',
      async () => {
        const payload = await requestJson(healthUrl);
        if (!payload) {
          return null;
        }
        return payload.status === 'degraded' ? payload : null;
      },
      STARTUP_TIMEOUT_MS
    );

    assert(
      degradedHealth.dependencies?.redis?.status !== 'ready',
      'Expected degraded API instance to report redis as unavailable.'
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}${formatLogs(api)}${formatLogs(jobs)}${formatLogs(degradedApi)}`
    );
  } finally {
    await stopProcess(degradedApi);
    await stopProcess(api);
    await stopProcess(jobs);
  }
}

async function main() {
  const runtimeEnv = loadRuntimeEnv();
  process.env.DATABASE_URL = runtimeEnv.DATABASE_URL;
  runWorkspaceChecks();
  runCommand('bun run --env-file=.env.example --env-file=.env --cwd packages/db migrate:deploy', {
    context: 'verify-s1_1:migrate',
  });
  await runRuntimeSmoke(runtimeEnv);
  console.log('[verify-s1_1] passed.');
}

main().catch((error) => {
  console.error(`[verify-s1_1] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
