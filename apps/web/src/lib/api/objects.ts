import {
  objectDetailInputSchema,
  objectDetailOutputSchema,
  objectsFeedInputSchema,
  objectsFeedOutputSchema,
  type ObjectDetailOutput,
  type ObjectsFeedInput,
  type ObjectsFeedOutput,
} from '@paperscraper/shared/browser';
import { trpcQuery } from './trpc';

export async function feedObjects(input: ObjectsFeedInput): Promise<ObjectsFeedOutput> {
  return trpcQuery('objects.feed', objectsFeedInputSchema.parse(input), objectsFeedOutputSchema);
}

export async function getObjectDetail(objectId: string): Promise<ObjectDetailOutput> {
  return trpcQuery(
    'objects.detail',
    objectDetailInputSchema.parse({ objectId }),
    objectDetailOutputSchema
  );
}
