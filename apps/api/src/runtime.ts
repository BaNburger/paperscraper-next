import { PrismaClient } from '@paperscraper/db';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createApiKeysEngine } from './engines/api-keys-engine';
import { createPipelineEngine } from './engines/pipeline-engine';
import { createQueryEngine } from './engines/query-engine';
import { createScoringEngine } from './engines/scoring-engine';
import { createStreamsEngine } from './engines/streams-engine';
import { createSystemEngine } from './engines/system-engine';
import { createWorkspaceEngine } from './engines/workspace-engine';
import type { ApiEnv } from './config';
import { createApiKeysProvider } from './providers/api-keys-provider';
import { createPipelineProvider } from './providers/pipeline-provider';
import { probePostgres } from './providers/postgres-provider';
import { createQueryProvider } from './providers/query-provider';
import { probeRedis } from './providers/redis-provider';
import { createScoringProvider } from './providers/scoring-provider';
import { createStreamQueue } from './providers/stream-queue-provider';
import { createStreamsProvider } from './providers/streams-provider';
import { createWorkspaceProvider } from './providers/workspace-provider';
import { appRouter } from './trpc/router';

function parseAllowedOrigins(value: string): string[] {
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parsed.length > 0 ? parsed : ['http://localhost:3333'];
}

function resolveAllowedOrigin(request: Request, allowedOrigins: string[]): string | null {
  const requestOrigin = request.headers.get('origin');
  if (!requestOrigin) {
    return null;
  }
  if (allowedOrigins.includes('*')) {
    return requestOrigin;
  }
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

function buildCorsHeaders(request: Request, allowedOrigins: string[]): Headers {
  const headers = new Headers();
  const allowedOrigin = resolveAllowedOrigin(request, allowedOrigins);
  if (!allowedOrigin) {
    return headers;
  }
  headers.set('Access-Control-Allow-Origin', allowedOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'content-type,authorization,trpc-batch-mode,x-trpc-source'
  );
  headers.set('Access-Control-Max-Age', '600');
  headers.set('Vary', 'Origin');
  return headers;
}

function withCors(response: Response, corsHeaders: Headers): Response {
  if (!corsHeaders.get('Access-Control-Allow-Origin')) {
    return response;
  }
  const headers = new Headers(response.headers);
  corsHeaders.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export interface ApiRuntime {
  close: () => Promise<void>;
  ready: {
    component: 'api';
    status: 'ready';
    port: number;
    trpcPath: string;
    ingestQueue: string;
    graphQueue: string;
  };
}

export interface ApiRuntimeEngines {
  systemEngine: ReturnType<typeof createSystemEngine>;
  streamsEngine: ReturnType<typeof createStreamsEngine>;
  scoringEngine: ReturnType<typeof createScoringEngine>;
  apiKeysEngine: ReturnType<typeof createApiKeysEngine>;
  queryEngine: ReturnType<typeof createQueryEngine>;
  pipelineEngine: ReturnType<typeof createPipelineEngine>;
  workspaceEngine: ReturnType<typeof createWorkspaceEngine>;
}

export function startApiRuntime(env: ApiEnv): ApiRuntime {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: env.DATABASE_URL },
    },
  });
  const streamQueue = createStreamQueue(env.REDIS_URL, env.JOB_QUEUE_NAME);
  const graphQueue = createStreamQueue(env.REDIS_URL, env.GRAPH_QUEUE_NAME);
  const systemEngine = createSystemEngine({
    postgresProbe: () => probePostgres(env.DATABASE_URL, env.HEALTH_PROBE_TIMEOUT_MS),
    redisProbe: () => probeRedis(env.REDIS_URL, env.HEALTH_PROBE_TIMEOUT_MS),
  });
  const streamsEngine = createStreamsEngine(
    createStreamsProvider(prisma, streamQueue.queue)
  );
  const scoringEngine = createScoringEngine(
    createScoringProvider(prisma, graphQueue.queue)
  );
  const apiKeysEngine = createApiKeysEngine(createApiKeysProvider(prisma), {
    secretsMasterKey: env.SECRETS_MASTER_KEY,
  });
  const queryEngine = createQueryEngine(createQueryProvider(prisma));
  const pipelineEngine = createPipelineEngine(createPipelineProvider(prisma));
  const workspaceEngine = createWorkspaceEngine(createWorkspaceProvider(prisma));
  const corsAllowedOrigins = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS);

  const requestHandler = async (request: Request): Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    const corsHeaders = buildCorsHeaders(request, corsAllowedOrigins);
    if (request.method === 'OPTIONS' && pathname.startsWith(env.TRPC_PATH)) {
      if (!corsHeaders.get('Access-Control-Allow-Origin')) {
        return new Response('Forbidden', { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (pathname === '/health') {
      const snapshot = await systemEngine.getHealthSnapshot();
      return withCors(
        Response.json(snapshot, {
          status: snapshot.status === 'failed' ? 503 : 200,
        }),
        corsHeaders
      );
    }
    if (pathname === env.TRPC_PATH || pathname.startsWith(`${env.TRPC_PATH}/`)) {
      const response = await fetchRequestHandler({
        endpoint: env.TRPC_PATH,
        req: request,
        router: appRouter,
        createContext: () => ({
          systemEngine,
          streamsEngine,
          scoringEngine,
          apiKeysEngine,
          queryEngine,
          pipelineEngine,
          workspaceEngine,
        }),
      });
      return withCors(response, corsHeaders);
    }
    return withCors(new Response('Not found', { status: 404 }), corsHeaders);
  };

  const server = Bun.serve({
    port: env.API_PORT,
    fetch: requestHandler,
  });

  let shuttingDown = false;
  const close = async (): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    server.stop(true);
    await streamQueue.close();
    await graphQueue.close();
    await prisma.$disconnect();
  };

  return {
    close,
    ready: {
      component: 'api',
      status: 'ready',
      port: env.API_PORT,
      trpcPath: env.TRPC_PATH,
      ingestQueue: env.JOB_QUEUE_NAME,
      graphQueue: env.GRAPH_QUEUE_NAME,
    },
  };
}
