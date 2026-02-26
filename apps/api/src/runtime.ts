import { PrismaClient } from '@paperscraper/db';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createStreamsEngine } from './engines/streams-engine';
import { createSystemEngine } from './engines/system-engine';
import type { ApiEnv } from './config';
import { probePostgres } from './providers/postgres-provider';
import { probeRedis } from './providers/redis-provider';
import { createStreamQueue } from './providers/stream-queue-provider';
import { createStreamsProvider } from './providers/streams-provider';
import { appRouter } from './trpc/router';
import type { TrpcContext } from './trpc/context';

export interface ApiRuntime {
  close: () => Promise<void>;
  ready: {
    component: 'api';
    status: 'ready';
    port: number;
    trpcPath: string;
    ingestQueue: string;
  };
}

export function startApiRuntime(env: ApiEnv): ApiRuntime {
  const prisma = new PrismaClient({
    datasources: {
      db: { url: env.DATABASE_URL },
    },
  });
  const streamQueue = createStreamQueue(env.REDIS_URL, env.JOB_QUEUE_NAME);
  const systemEngine = createSystemEngine({
    postgresProbe: () => probePostgres(env.DATABASE_URL, env.HEALTH_PROBE_TIMEOUT_MS),
    redisProbe: () => probeRedis(env.REDIS_URL, env.HEALTH_PROBE_TIMEOUT_MS),
  });
  const streamsEngine = createStreamsEngine(
    createStreamsProvider(prisma, streamQueue.queue)
  );

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
        createContext: (): TrpcContext => ({
          systemEngine,
          streamsEngine,
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
    },
  };
}
