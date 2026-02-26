import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { entityDetailQueryOptions } from '../entity-detail/queries';
import { EmptyState, ErrorState, LoadingState } from '../ui/route-state';
import { objectDetailQueryOptions } from './queries';

export function ObjectDetailScreen({ objectId }: { objectId: string }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery(objectDetailQueryOptions(objectId));

  return (
    <section className="screen" data-testid="object-detail-screen">
      <h1>Object Detail</h1>
      {detailQuery.isLoading ? <LoadingState label="Loading object..." /> : null}
      {detailQuery.error instanceof Error ? (
        <ErrorState message={detailQuery.error.message} />
      ) : null}
      {!detailQuery.isLoading && !detailQuery.data ? (
        <EmptyState label="Object not found." />
      ) : null}

      {detailQuery.data ? (
        <div className="detail-grid">
          <article className="panel-card">
            <h2>{detailQuery.data.title}</h2>
            <p className="muted">{detailQuery.data.externalId}</p>
            <p>{detailQuery.data.abstract || 'No abstract available.'}</p>
          </article>

          <article className="panel-card">
            <h3>Scores</h3>
            {detailQuery.data.scores.length === 0 ? <EmptyState label="No scores yet." /> : null}
            {detailQuery.data.scores.map((score) => (
              <div key={`${score.dimensionId}-${score.updatedAt}`} className="row-pair">
                <strong>{score.dimensionName}</strong>
                <span>{Math.round(score.value)}</span>
              </div>
            ))}
          </article>

          <article className="panel-card">
            <h3>Linked Entities</h3>
            {detailQuery.data.entities.length === 0 ? (
              <EmptyState label="No linked entities." />
            ) : null}
            {detailQuery.data.entities.map((link) => (
              <div key={`${link.entityId}-${link.role}`} className="row-pair">
                <Link
                  to="/entities/$entityId"
                  params={{ entityId: link.entityId }}
                  onMouseEnter={() => {
                    void queryClient.prefetchQuery(entityDetailQueryOptions(link.entityId));
                  }}
                >
                  {link.name}
                </Link>
                <span>{link.role}</span>
              </div>
            ))}
          </article>
        </div>
      ) : null}
    </section>
  );
}
