import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { objectDetailQueryOptions } from '../object-detail/queries';
import { EmptyState, ErrorState, LoadingState } from '../ui/route-state';
import { entityDetailQueryOptions } from './queries';

export function EntityDetailScreen({ entityId }: { entityId: string }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery(entityDetailQueryOptions(entityId));

  return (
    <section className="screen" data-testid="entity-detail-screen">
      <h1>Entity Detail</h1>
      {detailQuery.isLoading ? <LoadingState label="Loading entity..." /> : null}
      {detailQuery.error instanceof Error ? (
        <ErrorState message={detailQuery.error.message} />
      ) : null}
      {!detailQuery.isLoading && !detailQuery.data ? (
        <EmptyState label="Entity not found." />
      ) : null}

      {detailQuery.data ? (
        <div className="detail-grid">
          <article className="panel-card">
            <h2>{detailQuery.data.name}</h2>
            <p className="muted">
              {detailQuery.data.kind}
              {detailQuery.data.externalId ? ` | ${detailQuery.data.externalId}` : ''}
            </p>
          </article>

          <article className="panel-card">
            <h3>Aggregate Scores</h3>
            {detailQuery.data.scores.length === 0 ? <EmptyState label="No scores yet." /> : null}
            {detailQuery.data.scores.map((score) => (
              <div key={`${score.dimensionId}-${score.updatedAt}`} className="row-pair">
                <strong>{score.dimensionName}</strong>
                <span>{Math.round(score.value)}</span>
              </div>
            ))}
          </article>

          <article className="panel-card">
            <h3>Related Objects</h3>
            {detailQuery.data.relatedObjects.length === 0 ? (
              <EmptyState label="No related objects." />
            ) : null}
            {detailQuery.data.relatedObjects.map((object) => (
              <div key={`${object.objectId}-${object.role}`} className="row-pair">
                <Link
                  to="/objects/$objectId"
                  params={{ objectId: object.objectId }}
                  onMouseEnter={() => {
                    void queryClient.prefetchQuery(objectDetailQueryOptions(object.objectId));
                  }}
                >
                  {object.title}
                </Link>
                <span>{object.topScore ?? 'n/a'}</span>
              </div>
            ))}
          </article>
        </div>
      ) : null}
    </section>
  );
}
