import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { objectDetailQueryOptions } from '../object-detail/queries';
import { EmptyState, ErrorState, LoadingState } from '../ui/route-state';
import { entityDetailQueryOptions } from './queries';

export function EntityDetailScreen({ entityId }: { entityId: string }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery(entityDetailQueryOptions(entityId));

  return (
    <section className="grid gap-4" data-testid="entity-detail-screen">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Entity Detail</h1>
          <p className="text-sm text-muted-foreground">Aggregated evidence and related objects.</p>
        </div>
      </header>

      {detailQuery.isLoading ? <LoadingState label="Loading entity..." /> : null}
      {detailQuery.error instanceof Error ? <ErrorState message={detailQuery.error.message} /> : null}
      {!detailQuery.isLoading && !detailQuery.data ? <EmptyState label="Entity not found." /> : null}

      {detailQuery.data ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{detailQuery.data.name}</CardTitle>
              <CardDescription>{detailQuery.data.kind}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{detailQuery.data.externalId ?? 'No external id'}</Badge>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Aggregate Scores</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {detailQuery.data.scores.length === 0 ? <EmptyState label="No scores yet." /> : null}
                {detailQuery.data.scores.map((score) => (
                  <div key={`${score.dimensionId}-${score.updatedAt}`} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                    <strong>{score.dimensionName}</strong>
                    <span>{Math.round(score.value)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Related Objects</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {detailQuery.data.relatedObjects.length === 0 ? <EmptyState label="No related objects." /> : null}
                {detailQuery.data.relatedObjects.map((object) => (
                  <div key={`${object.objectId}-${object.role}`} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                    <Link
                      to="/objects/$objectId"
                      params={{ objectId: object.objectId }}
                      onMouseEnter={() => {
                        void queryClient.prefetchQuery(objectDetailQueryOptions(object.objectId));
                      }}
                    >
                      {object.title}
                    </Link>
                    <span className="text-muted-foreground">{object.topScore ?? 'n/a'}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}
