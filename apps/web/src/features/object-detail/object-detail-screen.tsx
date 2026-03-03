import { Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isObjectNotesEnabled } from '../../lib/feature-flags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { entityDetailQueryOptions } from '../entity-detail/queries';
import { EmptyState, ErrorState, LoadingState } from '../ui/route-state';
import { ObjectNoteEditor } from './object-note-editor';
import { objectDetailQueryOptions } from './queries';

export function ObjectDetailScreen({ objectId }: { objectId: string }) {
  const queryClient = useQueryClient();
  const detailQuery = useQuery(objectDetailQueryOptions(objectId));

  return (
    <section className="grid gap-4" data-testid="object-detail-screen">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Object Detail</h1>
          <p className="text-sm text-muted-foreground">Entity links, score evidence, and object notes.</p>
        </div>
      </header>

      {detailQuery.isLoading ? <LoadingState label="Loading object..." /> : null}
      {detailQuery.error instanceof Error ? <ErrorState message={detailQuery.error.message} /> : null}
      {!detailQuery.isLoading && !detailQuery.data ? <EmptyState label="Object not found." /> : null}

      {detailQuery.data ? (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>{detailQuery.data.title}</CardTitle>
              <CardDescription>
                {detailQuery.data.externalId} · {detailQuery.data.source}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>{detailQuery.data.abstract || 'No abstract available.'}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Published: {detailQuery.data.publishedAt ?? 'n/a'}</Badge>
                <Badge variant="outline">Pipeline cards: {detailQuery.data.pipelineCards.length}</Badge>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Scores</CardTitle>
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
                <CardTitle className="text-base">Linked Entities</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {detailQuery.data.entities.length === 0 ? <EmptyState label="No linked entities." /> : null}
                {detailQuery.data.entities.map((link) => (
                  <div key={`${link.entityId}-${link.role}`} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                    <Link
                      to="/entities/$entityId"
                      params={{ entityId: link.entityId }}
                      onMouseEnter={() => {
                        void queryClient.prefetchQuery(entityDetailQueryOptions(link.entityId));
                      }}
                    >
                      {link.name}
                    </Link>
                    <span className="text-muted-foreground">{link.role}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {isObjectNotesEnabled() ? <ObjectNoteEditor objectId={objectId} /> : null}
        </>
      ) : null}
    </section>
  );
}
