import {
  entityDetailInputSchema,
  entityDetailOutputSchema,
  objectDetailInputSchema,
  objectDetailOutputSchema,
  objectsFeedInputSchema,
  objectsFeedOutputSchema,
  type EntityDetailInput,
  type ObjectDetailInput,
  type ObjectsFeedInput,
} from '@paperscraper/shared';
import { TRPCError } from '@trpc/server';

export interface QueryEngineDeps {
  feedObjects: (input: ObjectsFeedInput) => Promise<unknown>;
  getObjectDetail: (objectId: string) => Promise<unknown | null>;
  getEntityDetail: (entityId: string) => Promise<unknown | null>;
}

export function createQueryEngine(deps: QueryEngineDeps) {
  return {
    async feed(input: ObjectsFeedInput) {
      const parsed = objectsFeedInputSchema.parse(input);
      const rows = await deps.feedObjects(parsed);
      return objectsFeedOutputSchema.parse(rows);
    },

    async objectDetail(input: ObjectDetailInput) {
      const parsed = objectDetailInputSchema.parse(input);
      const detail = await deps.getObjectDetail(parsed.objectId);
      if (!detail) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Object not found.' });
      }
      return objectDetailOutputSchema.parse(detail);
    },

    async entityDetail(input: EntityDetailInput) {
      const parsed = entityDetailInputSchema.parse(input);
      const detail = await deps.getEntityDetail(parsed.entityId);
      if (!detail) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found.' });
      }
      return entityDetailOutputSchema.parse(detail);
    },
  };
}

export type QueryEngine = ReturnType<typeof createQueryEngine>;
