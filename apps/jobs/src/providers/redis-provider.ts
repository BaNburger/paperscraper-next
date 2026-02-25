import IORedis from 'ioredis';

export function createRedisClient(redisUrl: string, lazyConnect: boolean): IORedis {
  const client = new IORedis(redisUrl, {
    lazyConnect,
    maxRetriesPerRequest: lazyConnect ? 1 : null,
    enableReadyCheck: true,
  });
  client.on('error', () => undefined);
  return client;
}

export async function pingRedis(client: IORedis): Promise<void> {
  if (client.status === 'wait') {
    await client.connect();
  }
  await client.ping();
}

export async function closeRedis(client: IORedis): Promise<void> {
  await client.quit().catch(() => {
    client.disconnect();
  });
}
