import type {
  ObjectsFeedOutput,
  PipelineSummary,
  StreamDto,
} from '@paperscraper/shared/browser';
import { Link } from '@tanstack/react-router';
import { EmptyState, ErrorState, LoadingState } from '../ui/route-state';
import type { FeedFilters, StageOption } from './types';

interface FeedMainPaneProps {
  filters: FeedFilters;
  streams: StreamDto[];
  pipelines: PipelineSummary[];
  stageOptions: StageOption[];
  feed: ObjectsFeedOutput | undefined;
  loading: boolean;
  queryError: string | null;
  actionError: string | null;
  pending: boolean;
  cursorHasPrevious: boolean;
  onFilterPatch: (patch: Partial<FeedFilters>) => void;
  onApplyFilters: () => void;
  onPreviousPage: () => void;
  onNextPage: (nextCursor: string | null) => void;
  onAddToPipeline: (objectId: string) => void;
}

export function FeedMainPane(props: FeedMainPaneProps) {
  return (
    <div className="split-main">
      <header className="screen-header">
        <h1>Feed</h1>
      </header>

      <div className="toolbar">
        <input
          data-testid="feed-filter-query"
          placeholder="Search title/abstract"
          value={props.filters.query || ''}
          onChange={(event) => props.onFilterPatch({ query: event.target.value || undefined })}
        />
        <select
          data-testid="feed-filter-sort"
          value={props.filters.sortBy}
          onChange={(event) =>
            props.onFilterPatch({
              sortBy: event.target.value === 'publishedAt' ? 'publishedAt' : 'topScore',
            })
          }
        >
          <option value="topScore">Sort: Top Score</option>
          <option value="publishedAt">Sort: Publication Date</option>
        </select>
        <select
          data-testid="feed-filter-stream"
          value={props.filters.streamId || ''}
          onChange={(event) => props.onFilterPatch({ streamId: event.target.value || undefined })}
        >
          <option value="">All Streams</option>
          {props.streams.map((stream) => (
            <option key={stream.id} value={stream.id}>
              {stream.name}
            </option>
          ))}
        </select>
        <select
          value={props.filters.pipelineId || ''}
          onChange={(event) =>
            props.onFilterPatch({
              pipelineId: event.target.value || undefined,
              stageId: undefined,
            })
          }
        >
          <option value="">All Pipelines</option>
          {props.pipelines.map((pipeline) => (
            <option key={pipeline.id} value={pipeline.id}>
              {pipeline.name}
            </option>
          ))}
        </select>
        <select
          value={props.filters.stageId || ''}
          onChange={(event) => props.onFilterPatch({ stageId: event.target.value || undefined })}
        >
          <option value="">All Stages</option>
          {props.stageOptions.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
        <button type="button" data-testid="feed-apply" onClick={props.onApplyFilters}>
          Apply
        </button>
      </div>

      {props.loading ? <LoadingState label="Loading feed..." /> : null}
      {props.queryError ? <ErrorState message={props.queryError} /> : null}
      {props.actionError ? <ErrorState message={props.actionError} /> : null}

      {!props.loading && !props.queryError && props.feed && props.feed.items.length === 0 ? (
        <EmptyState label="No objects found." />
      ) : null}

      <div className="object-list" data-testid="feed-list">
        {props.feed?.items.map((item) => (
          <article key={item.id} className="object-card">
            <div>
              <h3>
                <Link to="/objects/$objectId" params={{ objectId: item.id }}>
                  {item.title}
                </Link>
              </h3>
              <p className="muted">
                Top score: {item.topScore ?? 'n/a'} | Published: {item.publishedAt ?? 'n/a'}
              </p>
              <p className="muted">
                Entities:{' '}
                {item.entities.length > 0
                  ? item.entities.map((entity) => entity.name).join(', ')
                  : 'none'}
              </p>
            </div>
            <button type="button" onClick={() => props.onAddToPipeline(item.id)}>
              Add to Pipeline
            </button>
          </article>
        ))}
      </div>

      <div className="pagination">
        <button
          type="button"
          data-testid="feed-prev"
          disabled={!props.cursorHasPrevious || props.pending}
          onClick={props.onPreviousPage}
        >
          Previous
        </button>
        <button
          type="button"
          data-testid="feed-next"
          disabled={!props.feed?.nextCursor || props.pending}
          onClick={() => props.onNextPage(props.feed?.nextCursor ?? null)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
