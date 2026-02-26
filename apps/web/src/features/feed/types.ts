import type {
  FeedSort,
  PipelineStage,
  PipelineSummary,
  StreamDto,
  StreamRunDto,
} from '@paperscraper/shared/browser';

export type FeedFilters = {
  query?: string;
  streamId?: string;
  pipelineId?: string;
  stageId?: string;
  sortBy: FeedSort;
};

export type FeedPaneTab = 'streams' | 'apiKeys';

export type StreamDraft = Pick<StreamDto, 'name' | 'query' | 'maxObjects' | 'isActive'>;

export type StageOption = Pick<PipelineStage, 'id' | 'name'>;

export interface FeedViewModel {
  streams: StreamDto[];
  streamRuns: StreamRunDto[];
  pipelines: PipelineSummary[];
  stageOptions: StageOption[];
}
