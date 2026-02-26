import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pipelineBoardQueryOptions, pipelinesListQueryOptions } from './queries';

function asErrorMessage(value: unknown): string | null {
  if (value instanceof Error && value.message.trim().length > 0) {
    return value.message;
  }
  return null;
}

export function usePipelineBoardData() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | undefined>(undefined);

  const pipelinesQuery = useQuery(pipelinesListQueryOptions());

  const effectivePipelineId = useMemo(
    () => selectedPipelineId || pipelinesQuery.data?.[0]?.id,
    [selectedPipelineId, pipelinesQuery.data]
  );

  const boardQuery = useQuery(pipelineBoardQueryOptions(effectivePipelineId));

  useEffect(() => {
    if (!selectedPipelineId && boardQuery.data?.pipeline.id) {
      setSelectedPipelineId(boardQuery.data.pipeline.id);
    }
  }, [selectedPipelineId, boardQuery.data]);

  return {
    selectedPipelineId: effectivePipelineId,
    setSelectedPipelineId,
    pipelines: pipelinesQuery.data || [],
    board: boardQuery.data,
    loading: pipelinesQuery.isLoading || boardQuery.isLoading,
    error: asErrorMessage(pipelinesQuery.error) || asErrorMessage(boardQuery.error),
  };
}
