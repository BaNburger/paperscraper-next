import { createFileRoute } from '@tanstack/react-router';
import { pipelinesListQueryOptions } from '../features/pipeline/queries';
import { streamsListQueryOptions } from '../features/streams/queries';

export const Route = createFileRoute('/feed')({
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(streamsListQueryOptions()),
      context.queryClient.ensureQueryData(pipelinesListQueryOptions()),
    ]);
  },
});
