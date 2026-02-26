import {
  entityDetailInputSchema,
  entityDetailOutputSchema,
  type EntityDetailOutput,
} from '@paperscraper/shared/browser';
import { trpcQuery } from './trpc';

export async function getEntityDetail(entityId: string): Promise<EntityDetailOutput> {
  return trpcQuery(
    'entities.detail',
    entityDetailInputSchema.parse({ entityId }),
    entityDetailOutputSchema
  );
}
