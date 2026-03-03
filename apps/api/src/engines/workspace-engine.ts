import {
  objectNoteGetInputSchema,
  objectNoteSchema,
  objectNoteUpsertInputSchema,
  objectNoteUpsertResultSchema,
  workspaceFeedPreferencesGetInputSchema,
  workspaceFeedPreferencesSchema,
  workspaceFeedPreferencesUpsertInputSchema,
  workspaceSavedViewCreateInputSchema,
  workspaceSavedViewDeleteInputSchema,
  workspaceSavedViewDeleteOutputSchema,
  workspaceSavedViewUpdateInputSchema,
  workspaceSavedViewsListInputSchema,
  feedSavedViewSchema,
  type ObjectNoteGetInput,
  type ObjectNoteUpsertInput,
  type WorkspaceFeedPreferencesGetInput,
  type WorkspaceFeedPreferencesUpsertInput,
  type WorkspaceSavedViewCreateInput,
  type WorkspaceSavedViewDeleteInput,
  type WorkspaceSavedViewUpdateInput,
  type WorkspaceSavedViewsListInput,
} from '@paperscraper/shared';
import { TRPCError } from '@trpc/server';

const DEFAULT_PREFERENCES = {
  defaultDensity: 'comfortable',
  defaultVisibleColumns: ['title', 'topScore', 'publishedAt', 'entities', 'stage'],
  feedSidePaneWidth: 360,
  pipelineSidePaneWidth: 360,
  lastSavedViewId: null,
} as const;

export interface WorkspaceEngineDeps {
  listSavedViews: () => Promise<unknown[]>;
  createSavedView: (input: WorkspaceSavedViewCreateInput) => Promise<unknown>;
  updateSavedView: (input: WorkspaceSavedViewUpdateInput) => Promise<unknown | null>;
  deleteSavedView: (id: string) => Promise<unknown | null>;
  getFeedPreferences: () => Promise<unknown | null>;
  upsertFeedPreferences: (value: WorkspaceFeedPreferencesUpsertInput) => Promise<unknown>;
  getObjectNote: (objectId: string) => Promise<unknown | null>;
  upsertObjectNote: (input: ObjectNoteUpsertInput) => Promise<unknown>;
}

export function createWorkspaceEngine(deps: WorkspaceEngineDeps) {
  return {
    async listSavedViews(input: WorkspaceSavedViewsListInput) {
      workspaceSavedViewsListInputSchema.parse(input);
      const savedViews = await deps.listSavedViews();
      return savedViews.map((savedView) => feedSavedViewSchema.parse(savedView));
    },

    async createSavedView(input: WorkspaceSavedViewCreateInput) {
      const parsed = workspaceSavedViewCreateInputSchema.parse(input);
      const created = await deps.createSavedView(parsed);
      return feedSavedViewSchema.parse(created);
    },

    async updateSavedView(input: WorkspaceSavedViewUpdateInput) {
      const parsed = workspaceSavedViewUpdateInputSchema.parse(input);
      const updated = await deps.updateSavedView(parsed);
      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Saved view not found.' });
      }
      return feedSavedViewSchema.parse(updated);
    },

    async deleteSavedView(input: WorkspaceSavedViewDeleteInput) {
      const parsed = workspaceSavedViewDeleteInputSchema.parse(input);
      const deleted = await deps.deleteSavedView(parsed.id);
      if (!deleted) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Saved view not found.' });
      }
      return workspaceSavedViewDeleteOutputSchema.parse(deleted);
    },

    async getFeedPreferences(input: WorkspaceFeedPreferencesGetInput) {
      workspaceFeedPreferencesGetInputSchema.parse(input);
      const value = await deps.getFeedPreferences();
      if (!value) {
        return workspaceFeedPreferencesSchema.parse(DEFAULT_PREFERENCES);
      }
      return workspaceFeedPreferencesSchema.parse(value);
    },

    async upsertFeedPreferences(input: WorkspaceFeedPreferencesUpsertInput) {
      const parsed = workspaceFeedPreferencesUpsertInputSchema.parse(input);
      const updated = await deps.upsertFeedPreferences(parsed);
      return workspaceFeedPreferencesSchema.parse(updated);
    },

    async getObjectNote(input: ObjectNoteGetInput) {
      const parsed = objectNoteGetInputSchema.parse(input);
      const note = await deps.getObjectNote(parsed.objectId);
      if (!note) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Object not found.' });
      }
      return objectNoteSchema.parse(note);
    },

    async upsertObjectNote(input: ObjectNoteUpsertInput) {
      const parsed = objectNoteUpsertInputSchema.parse(input);
      try {
        const result = await deps.upsertObjectNote(parsed);
        return objectNoteUpsertResultSchema.parse(result);
      } catch (cause) {
        if (cause instanceof Error && cause.message === 'Object not found.') {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Object not found.' });
        }
        throw cause;
      }
    },
  };
}

export type WorkspaceEngine = ReturnType<typeof createWorkspaceEngine>;
