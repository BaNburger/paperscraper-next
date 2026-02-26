import type { ObjectsFeedInput } from '@paperscraper/shared/browser';

export const queryKeys = {
  objectsFeed: (input: ObjectsFeedInput) => ['objects', 'feed', input] as const,
  objectDetail: (objectId: string) => ['objects', 'detail', objectId] as const,
  entityDetail: (entityId: string) => ['entities', 'detail', entityId] as const,
  streams: () => ['streams', 'list'] as const,
  streamRuns: (streamId: string, limit: number) => ['streams', 'runs', streamId, limit] as const,
  pipelines: () => ['pipelines', 'list'] as const,
  pipelineBoard: (pipelineId?: string) => ['pipelines', 'board', pipelineId ?? null] as const,
  apiKeyProviders: () => ['api-keys', 'providers'] as const,
};
