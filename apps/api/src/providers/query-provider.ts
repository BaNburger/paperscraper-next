import type { PrismaClient } from '@paperscraper/db';
import type {
  EntityDetailOutput,
  ObjectDetailOutput,
  ObjectsFeedInput,
  ObjectsFeedOutput,
} from '@paperscraper/shared';
import { feedObjects } from './query-provider-feed';
import { getEntityDetail, getObjectDetail } from './query-provider-detail';

export interface QueryProviderDeps {
  feedObjects: (input: ObjectsFeedInput) => Promise<ObjectsFeedOutput>;
  getObjectDetail: (objectId: string) => Promise<ObjectDetailOutput | null>;
  getEntityDetail: (entityId: string) => Promise<EntityDetailOutput | null>;
}

export function createQueryProvider(prisma: PrismaClient): QueryProviderDeps {
  return {
    feedObjects: (input) => feedObjects(prisma, input),
    getObjectDetail: (objectId) => getObjectDetail(prisma, objectId),
    getEntityDetail: (entityId) => getEntityDetail(prisma, entityId),
  };
}
