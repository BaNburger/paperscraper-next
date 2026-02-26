import { PrismaClient } from '@paperscraper/db';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createApiKeysEngine } from './engines/api-keys-engine';
import { createPipelineEngine } from './engines/pipeline-engine';
import { createQueryEngine } from './engines/query-engine';
import { createScoringEngine } from './engines/scoring-engine';
import { createStreamsEngine } from './engines/streams-engine';
import { createSystemEngine } from './engines/system-engine';
import type { ApiEnv } from './config';
import { createApiKeysProvider } from './providers/api-keys-provider';
import { createPipelineProvider } from './providers/pipeline-provider';
import { probePostgres } from './providers/postgres-provider';
import { createQueryProvider } from './providers/query-provider';
import { probeRedis } from './providers/redis-provider';
import { createScoringProvider } from './providers/scoring-provider';
import { createStreamQueue } from './providers/stream-queue-provider';
import { createStreamsProvider } from './providers/streams-provider';
import { appRouter } from './trpc/router';

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

  const requestHandler = async (request: Request): Promise<Response> => {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/health') {
      const snapshot = await systemEngine.getHealthSnapshot();
      return Response.json(snapshot, {
        status: snapshot.status === 'failed' ? 503 : 200,
      });
    }
    if (pathname === env.TRPC_PATH || pathname.startsWith(`${env.TRPC_PATH}/`)) {
      return fetchRequestHandler({
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
          }),
      });
    }
    return new Response('Not found', { status: 404 });
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
