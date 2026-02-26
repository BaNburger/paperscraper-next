import { queryOptions } from '@tanstack/react-query';
import { listStreamRuns, listStreams } from '../../lib/api/streams';
import { queryKeys } from '../query/keys';

export const streamsListQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.streams(),
    queryFn: () => listStreams(),
    staleTime: 10_000,
  });

export const streamRunsQueryOptions = (streamId: string, limit: number) =>
  queryOptions({
    queryKey: queryKeys.streamRuns(streamId, limit),
    queryFn: () => listStreamRuns(streamId, limit),
    staleTime: 2_000,
  });
