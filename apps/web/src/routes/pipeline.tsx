import { createFileRoute } from '@tanstack/react-router';
import {
  pipelineBoardQueryOptions,
  pipelinesListQueryOptions,
} from '../features/pipeline/queries';

export const Route = createFileRoute('/pipeline')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(pipelinesListQueryOptions());
    await context.queryClient.ensureQueryData(pipelineBoardQueryOptions(undefined));
  },
});
