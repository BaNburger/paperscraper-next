import { queryOptions } from '@tanstack/react-query';
import {
  getWorkspaceFeedPreferences,
  getWorkspaceObjectNote,
  listWorkspaceSavedViews,
} from '../../lib/api/workspace';
import { queryKeys } from '../query/keys';

export const workspaceSavedViewsQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.workspaceSavedViews(),
    queryFn: listWorkspaceSavedViews,
    staleTime: 2_000,
  });

export const workspaceFeedPreferencesQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.workspaceFeedPreferences(),
    queryFn: getWorkspaceFeedPreferences,
    staleTime: 2_000,
  });

export const objectNoteQueryOptions = (objectId: string) =>
  queryOptions({
    queryKey: queryKeys.objectNote(objectId),
    queryFn: () => getWorkspaceObjectNote(objectId),
    staleTime: 1_000,
    enabled: objectId.length > 0,
  });
