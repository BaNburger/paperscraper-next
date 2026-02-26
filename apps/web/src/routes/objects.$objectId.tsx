import { createFileRoute } from '@tanstack/react-router';
import { objectDetailQueryOptions } from '../features/object-detail/queries';

export const Route = createFileRoute('/objects/$objectId')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(objectDetailQueryOptions(params.objectId));
  },
});
