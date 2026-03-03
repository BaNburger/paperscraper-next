import type {
  FeedColumn,
  FeedSort,
  PipelineStage,
} from '@paperscraper/shared/browser';

export type FeedFilters = {
  query?: string;
  streamId?: string;
  pipelineId?: string;
  stageId?: string;
  sortBy: FeedSort;
};

export type FeedPaneTab = 'streams' | 'apiKeys';

export type StreamDraft = {
  name: string;
  query: string;
  maxObjectsInput: string;
  isActive: boolean;
};

export type StageOption = Pick<PipelineStage, 'id' | 'name'>;

export const DEFAULT_VISIBLE_COLUMNS: FeedColumn[] = [
  'title',
  'topScore',
  'publishedAt',
  'entities',
  'stage',
];
