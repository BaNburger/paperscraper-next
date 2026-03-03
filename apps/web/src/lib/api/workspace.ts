import {
  feedSavedViewSchema,
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
  type FeedSavedView,
  type ObjectNote,
  type ObjectNoteUpsertInput,
  type ObjectNoteUpsertResult,
  type WorkspaceFeedPreferences,
  type WorkspaceSavedViewCreateInput,
  type WorkspaceSavedViewDeleteOutput,
  type WorkspaceSavedViewUpdateInput,
} from '@paperscraper/shared/browser';
import { z } from 'zod';
import { trpcMutation, trpcQuery } from './trpc';

export async function listWorkspaceSavedViews(): Promise<FeedSavedView[]> {
  return trpcQuery(
    'workspace.listSavedViews',
    workspaceSavedViewsListInputSchema.parse({}),
    z.array(feedSavedViewSchema)
  );
}

export async function createWorkspaceSavedView(
  input: WorkspaceSavedViewCreateInput
): Promise<FeedSavedView> {
  return trpcMutation(
    'workspace.createSavedView',
    workspaceSavedViewCreateInputSchema.parse(input),
    feedSavedViewSchema
  );
}

export async function updateWorkspaceSavedView(
  input: WorkspaceSavedViewUpdateInput
): Promise<FeedSavedView> {
  return trpcMutation(
    'workspace.updateSavedView',
    workspaceSavedViewUpdateInputSchema.parse(input),
    feedSavedViewSchema
  );
}

export async function deleteWorkspaceSavedView(id: string): Promise<WorkspaceSavedViewDeleteOutput> {
  return trpcMutation(
    'workspace.deleteSavedView',
    workspaceSavedViewDeleteInputSchema.parse({ id }),
    workspaceSavedViewDeleteOutputSchema
  );
}

export async function getWorkspaceFeedPreferences(): Promise<WorkspaceFeedPreferences> {
  return trpcQuery(
    'workspace.getFeedPreferences',
    workspaceFeedPreferencesGetInputSchema.parse({}),
    workspaceFeedPreferencesSchema
  );
}

export async function upsertWorkspaceFeedPreferences(
  input: WorkspaceFeedPreferences
): Promise<WorkspaceFeedPreferences> {
  return trpcMutation(
    'workspace.upsertFeedPreferences',
    workspaceFeedPreferencesUpsertInputSchema.parse(input),
    workspaceFeedPreferencesSchema
  );
}

export async function getWorkspaceObjectNote(objectId: string): Promise<ObjectNote> {
  return trpcQuery(
    'workspace.getObjectNote',
    objectNoteGetInputSchema.parse({ objectId }),
    objectNoteSchema
  );
}

export async function upsertWorkspaceObjectNote(
  input: ObjectNoteUpsertInput
): Promise<ObjectNoteUpsertResult> {
  return trpcMutation(
    'workspace.upsertObjectNote',
    objectNoteUpsertInputSchema.parse(input),
    objectNoteUpsertResultSchema
  );
}
