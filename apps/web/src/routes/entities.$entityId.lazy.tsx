import { createLazyFileRoute } from '@tanstack/react-router';
import { EntityDetailScreen } from '../features/entity-detail/entity-detail-screen';

export const Route = createLazyFileRoute('/entities/$entityId')({
  component: EntityDetailRoute,
});

function EntityDetailRoute() {
  const { entityId } = Route.useParams();
  return <EntityDetailScreen entityId={entityId} />;
}
