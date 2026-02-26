import { createFileRoute } from '@tanstack/react-router';
import { entityDetailQueryOptions } from '../features/entity-detail/queries';

export const Route = createFileRoute('/entities/$entityId')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(entityDetailQueryOptions(params.entityId));
  },
});
