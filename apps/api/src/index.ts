import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createSystemEngine } from './engines/system-engine';
import { loadApiEnv } from './config';
import { probePostgres } from './providers/postgres-provider';
import { probeRedis } from './providers/redis-provider';
import { appRouter } from './trpc/router';
import type { TrpcContext } from './trpc/context';

const env = loadApiEnv();

const systemEngine = createSystemEngine({
  postgresProbe: () => probePostgres(env.DATABASE_URL, env.HEALTH_PROBE_TIMEOUT_MS),
  redisProbe: () => probeRedis(env.REDIS_URL, env.HEALTH_PROBE_TIMEOUT_MS),
});

async function requestHandler(request: Request): Promise<Response> {
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
      createContext: (): TrpcContext => ({ systemEngine }),
    });
  }

  return new Response('Not found', { status: 404 });
}

Bun.serve({
  port: env.API_PORT,
  fetch: requestHandler,
});

console.log(
  JSON.stringify({
    component: 'api',
    status: 'ready',
    port: env.API_PORT,
    trpcPath: env.TRPC_PATH,
  })
);
