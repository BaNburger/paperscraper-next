import type { ObjectsFeedInput } from '@paperscraper/shared/browser';
import { queryOptions } from '@tanstack/react-query';
import { feedObjects } from '../../lib/api/objects';
import { queryKeys } from '../query/keys';

export const feedQueryOptions = (input: ObjectsFeedInput) =>
  queryOptions({
    queryKey: queryKeys.objectsFeed(input),
    queryFn: () => feedObjects(input),
    staleTime: 1_000,
  });
