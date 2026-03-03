import type { PrismaClient } from '@paperscraper/db';
import type {
  FeedSavedView,
  ObjectNote,
  ObjectNoteUpsertInput,
  ObjectNoteUpsertResult,
  WorkspaceFeedPreferences,
  WorkspaceSavedViewCreateInput,
  WorkspaceSavedViewDeleteOutput,
  WorkspaceSavedViewUpdateInput,
} from '@paperscraper/shared';

const FEED_PREFERENCES_KEY = 'feed.preferences.v1';
const EMPTY_NOTE_DOCUMENT: [] = [];

function toSavedView(row: {
  id: string;
  name: string;
  definition: unknown;
  createdAt: Date;
  updatedAt: Date;
}): FeedSavedView {
  return {
    id: row.id,
    name: row.name,
    definition: row.definition as FeedSavedView['definition'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toObjectNote(row: {
  objectId: string;
  document: unknown;
  revision: number;
  updatedAt: Date;
}): ObjectNote {
  return {
    objectId: row.objectId,
    document: row.document as ObjectNote['document'],
    revision: row.revision,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface WorkspaceProviderDeps {
  listSavedViews: () => Promise<FeedSavedView[]>;
  createSavedView: (input: WorkspaceSavedViewCreateInput) => Promise<FeedSavedView>;
  updateSavedView: (input: WorkspaceSavedViewUpdateInput) => Promise<FeedSavedView | null>;
  deleteSavedView: (id: string) => Promise<WorkspaceSavedViewDeleteOutput | null>;
  getFeedPreferences: () => Promise<WorkspaceFeedPreferences | null>;
  upsertFeedPreferences: (value: WorkspaceFeedPreferences) => Promise<WorkspaceFeedPreferences>;
  getObjectNote: (objectId: string) => Promise<ObjectNote | null>;
  upsertObjectNote: (input: ObjectNoteUpsertInput) => Promise<ObjectNoteUpsertResult>;
}

export function createWorkspaceProvider(prisma: PrismaClient): WorkspaceProviderDeps {
  return {
    listSavedViews: async () => {
      const rows = await prisma.feedSavedView.findMany({
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          definition: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return rows.map(toSavedView);
    },

    createSavedView: async (input) => {
      const row = await prisma.feedSavedView.create({
        data: {
          name: input.name,
          definition: input.definition,
        },
        select: {
          id: true,
          name: true,
          definition: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return toSavedView(row);
    },

    updateSavedView: async (input) => {
      const existing = await prisma.feedSavedView.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      if (!existing) {
        return null;
      }
      const row = await prisma.feedSavedView.update({
        where: { id: input.id },
        data: {
          name: input.name,
          definition: input.definition,
        },
        select: {
          id: true,
          name: true,
          definition: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return toSavedView(row);
    },

    deleteSavedView: async (id) => {
      const existing = await prisma.feedSavedView.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!existing) {
        return null;
      }
      await prisma.feedSavedView.delete({
        where: { id },
        select: { id: true },
      });
      return { id, status: 'deleted' };
    },

    getFeedPreferences: async () => {
      const row = await prisma.workspacePreference.findUnique({
        where: { key: FEED_PREFERENCES_KEY },
        select: { value: true },
      });
      return row ? (row.value as WorkspaceFeedPreferences) : null;
    },

    upsertFeedPreferences: async (value) => {
      const row = await prisma.workspacePreference.upsert({
        where: { key: FEED_PREFERENCES_KEY },
        create: {
          key: FEED_PREFERENCES_KEY,
          value,
        },
        update: {
          value,
        },
        select: { value: true },
      });
      return row.value as WorkspaceFeedPreferences;
    },

    getObjectNote: async (objectId) => {
      const object = await prisma.researchObject.findUnique({
        where: { id: objectId },
        select: { id: true, updatedAt: true },
      });
      if (!object) {
        return null;
      }
      const row = await prisma.objectNote.findUnique({
        where: { objectId },
        select: {
          objectId: true,
          document: true,
          revision: true,
          updatedAt: true,
        },
      });
      if (!row) {
        return {
          objectId,
          document: EMPTY_NOTE_DOCUMENT,
          revision: 0,
          updatedAt: object.updatedAt.toISOString(),
        };
      }
      return toObjectNote(row);
    },

    upsertObjectNote: async (input) => {
      return prisma.$transaction(async (tx) => {
        const object = await tx.researchObject.findUnique({
          where: { id: input.objectId },
          select: { id: true, updatedAt: true },
        });
        if (!object) {
          throw new Error('Object not found.');
        }

        const current = await tx.objectNote.findUnique({
          where: { objectId: input.objectId },
          select: {
            objectId: true,
            document: true,
            revision: true,
            updatedAt: true,
          },
        });

        if (!current && input.expectedRevision !== null && input.expectedRevision !== 0) {
          return {
            status: 'conflict',
            latest: {
              objectId: input.objectId,
              document: EMPTY_NOTE_DOCUMENT,
              revision: 0,
              updatedAt: object.updatedAt.toISOString(),
            },
          } satisfies ObjectNoteUpsertResult;
        }

        if (current && input.expectedRevision !== current.revision) {
          return {
            status: 'conflict',
            latest: toObjectNote(current),
          } satisfies ObjectNoteUpsertResult;
        }

        if (current) {
          const row = await tx.objectNote.update({
            where: { objectId: input.objectId },
            data: {
              document: input.document as never,
              revision: current.revision + 1,
            },
            select: {
              objectId: true,
              document: true,
              revision: true,
              updatedAt: true,
            },
          });
          return { status: 'updated', note: toObjectNote(row) } satisfies ObjectNoteUpsertResult;
        }

        const row = await tx.objectNote.create({
          data: {
            objectId: input.objectId,
            document: input.document as never,
            revision: 1,
          },
          select: {
            objectId: true,
            document: true,
            revision: true,
            updatedAt: true,
          },
        });
        return { status: 'updated', note: toObjectNote(row) } satisfies ObjectNoteUpsertResult;
      });
    },
  };
}
