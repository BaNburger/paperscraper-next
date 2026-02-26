import { queryOptions } from '@tanstack/react-query';
import { getPipelineBoard, listPipelines } from '../../lib/api/pipelines';
import { queryKeys } from '../query/keys';

export const pipelinesListQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.pipelines(),
    queryFn: () => listPipelines(),
    staleTime: 10_000,
  });

export const pipelineBoardQueryOptions = (pipelineId?: string) =>
  queryOptions({
    queryKey: queryKeys.pipelineBoard(pipelineId),
    queryFn: () => getPipelineBoard(pipelineId),
    staleTime: 2_000,
  });
