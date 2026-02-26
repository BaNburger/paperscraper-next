import { createLazyFileRoute } from '@tanstack/react-router';
import { ObjectDetailScreen } from '../features/object-detail/object-detail-screen';

export const Route = createLazyFileRoute('/objects/$objectId')({
  component: ObjectDetailRoute,
});

function ObjectDetailRoute() {
  const { objectId } = Route.useParams();
  return <ObjectDetailScreen objectId={objectId} />;
}
