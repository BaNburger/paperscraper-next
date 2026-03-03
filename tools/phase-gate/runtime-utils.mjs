import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { runCommand } from '../lib/common.mjs';

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function readEnvFile(filePath) {
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
    env[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return env;
}

function loadRuntimeDefaults(root) {
  const defaultsPath = path.join(
    root,
    'packages',
    'shared',
    'src',
    'runtime-defaults.json'
  );
  const parsed = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
  return parsed;
}

export function loadRuntimeEnv(root, overrides = {}) {
  const defaults = loadRuntimeDefaults(root);
  const envExample = readEnvFile(path.join(root, '.env.example'));
  const envLocal = readEnvFile(path.join(root, '.env'));
  const runtimeEnv = {
    ...envExample,
    ...envLocal,
    ...process.env,
    ...overrides,
  };
  runtimeEnv.API_PORT = runtimeEnv.API_PORT || String(defaults.apiPort);
  runtimeEnv.DATABASE_URL =
    runtimeEnv.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/paperscraper_next?schema=public';
  runtimeEnv.REDIS_URL = runtimeEnv.REDIS_URL || 'redis://localhost:6379';
  runtimeEnv.TRPC_PATH = runtimeEnv.TRPC_PATH || defaults.trpcPath;
  runtimeEnv.JOB_QUEUE_NAME = runtimeEnv.JOB_QUEUE_NAME || defaults.jobQueueName;
  runtimeEnv.GRAPH_QUEUE_NAME = runtimeEnv.GRAPH_QUEUE_NAME || defaults.graphQueueName;
  runtimeEnv.VITE_API_BASE_URL =
    runtimeEnv.VITE_API_BASE_URL || defaults.apiBaseUrl;
  runtimeEnv.OPENALEX_BASE_URL =
    runtimeEnv.OPENALEX_BASE_URL || defaults.openAlexBaseUrl;
  runtimeEnv.OPENALEX_API_KEY = runtimeEnv.OPENALEX_API_KEY || '';
  runtimeEnv.OPENAI_BASE_URL = runtimeEnv.OPENAI_BASE_URL || defaults.openAiBaseUrl;
  runtimeEnv.ANTHROPIC_BASE_URL =
    runtimeEnv.ANTHROPIC_BASE_URL || defaults.anthropicBaseUrl;
  runtimeEnv.OPENAI_TIMEOUT_MS = runtimeEnv.OPENAI_TIMEOUT_MS || '30000';
  runtimeEnv.OPENAI_MAX_RETRIES = runtimeEnv.OPENAI_MAX_RETRIES || '2';
  runtimeEnv.OPENAI_RETRY_BASE_DELAY_MS =
    runtimeEnv.OPENAI_RETRY_BASE_DELAY_MS || '250';
  runtimeEnv.ANTHROPIC_TIMEOUT_MS = runtimeEnv.ANTHROPIC_TIMEOUT_MS || '30000';
  runtimeEnv.ANTHROPIC_MAX_RETRIES = runtimeEnv.ANTHROPIC_MAX_RETRIES || '2';
  runtimeEnv.ANTHROPIC_RETRY_BASE_DELAY_MS =
    runtimeEnv.ANTHROPIC_RETRY_BASE_DELAY_MS || '250';
  runtimeEnv.OPENAI_API_KEY = runtimeEnv.OPENAI_API_KEY || '';
  runtimeEnv.ANTHROPIC_API_KEY = runtimeEnv.ANTHROPIC_API_KEY || '';
  runtimeEnv.OPENAI_SMOKE_MODEL = runtimeEnv.OPENAI_SMOKE_MODEL || 'gpt-4o-mini';
  runtimeEnv.ANTHROPIC_SMOKE_MODEL =
    runtimeEnv.ANTHROPIC_SMOKE_MODEL || 'claude-3-5-haiku-latest';
  runtimeEnv.SECRETS_MASTER_KEY = runtimeEnv.SECRETS_MASTER_KEY || '';
  return runtimeEnv;
}

export function parseVerifyMode(argv, defaultMode = 'runtime') {
  const requested = argv
    .map((value) => value.trim())
    .find((value) => value.startsWith('--mode='));
  const parsedMode = requested ? requested.slice('--mode='.length) : defaultMode;
  if (parsedMode !== 'fast' && parsedMode !== 'runtime') {
    throw new Error(`Invalid --mode value '${parsedMode}'. Expected 'fast' or 'runtime'.`);
  }
  return parsedMode;
}

export function runWorkspaceChecks(workspaces, label) {
  for (const workspace of workspaces) {
    runCommand(`npm --prefix ${workspace} run lint --if-present`, {
      context: `${label}:lint:${workspace}`,
    });
    runCommand(`npm --prefix ${workspace} run test --if-present`, {
      context: `${label}:test:${workspace}`,
    });
  }
}

export function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Could not determine free port.'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

export function createProcess(root, command, args, env, name) {
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
          // ignore non-JSON logs from npm/bun wrappers
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

export async function stopProcess(handle, shutdownTimeoutMs = 3000) {
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
    }, shutdownTimeoutMs);
    const forceResolve = setTimeout(() => {
      clearTimeout(timeout);
      finish();
    }, shutdownTimeoutMs + 1000);
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

export async function waitFor(description, fn, timeoutMs = 20000, pollIntervalMs = 250) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await fn();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Timeout waiting for ${description}.`);
}

export function requestJson(url, options = {}) {
  return new Promise((resolve) => {
    const target = new URL(url);
    const client = target.protocol === 'https:' ? https : http;
    const request = client.request(
      target,
      {
        method: options.method || 'GET',
        timeout: options.timeoutMs || 3000,
        headers: options.body ? { 'content-type': 'application/json' } : undefined,
      },
      (response) => {
        let body = '';
        response.on('data', (chunk) => {
          body += chunk.toString();
        });
        response.on('end', () => {
          try {
            resolve({
              statusCode: response.statusCode || 500,
              body: body ? JSON.parse(body) : {},
            });
          } catch {
            resolve({ statusCode: 500, body: null });
          }
        });
      }
    );
    request.on('timeout', () => {
      request.destroy();
      resolve({ statusCode: 504, body: null });
    });
    request.on('error', () => resolve({ statusCode: 503, body: null }));
    if (options.body) {
      request.write(options.body);
    }
    request.end();
  });
}

export function trpcData(response) {
  if (!response || response.statusCode >= 400 || !response.body) {
    return null;
  }
  if (response.body.error) {
    return { error: response.body.error };
  }
  return response.body.result?.data ?? null;
}

export async function trpcQuery(baseUrl, trpcPath, procedure, input) {
  const encoded = encodeURIComponent(JSON.stringify(input || {}));
  const response = await requestJson(`${baseUrl}${trpcPath}/${procedure}?input=${encoded}`);
  return trpcData(response);
}

export async function trpcMutation(baseUrl, trpcPath, procedure, input) {
  const response = await requestJson(`${baseUrl}${trpcPath}/${procedure}`, {
    method: 'POST',
    body: JSON.stringify(input || {}),
  });
  return trpcData(response);
}

export function formatLogs(handle, maxLines = 20) {
  if (!handle) {
    return '';
  }
  const lastLines = handle.logs.slice(-maxLines).join('\n');
  return lastLines ? `\nRecent logs from ${handle.name}:\n${lastLines}` : '';
}
