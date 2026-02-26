import {
  streamCreateInputSchema,
  streamRunSchema,
  streamSchema,
  streamTriggerInputSchema,
  streamUpdateInputSchema,
  streamsListInputSchema,
  streamRunsInputSchema,
  type StreamCreateInput,
  type StreamDto,
  type StreamRunDto,
  type StreamUpdateInput,
} from '@paperscraper/shared/browser';
import { z } from 'zod';
import { trpcMutation, trpcQuery } from './trpc';

export async function listStreams(): Promise<StreamDto[]> {
  return trpcQuery('streams.list', streamsListInputSchema.parse({}), z.array(streamSchema));
}

export async function createStream(input: StreamCreateInput): Promise<StreamDto> {
  return trpcMutation('streams.create', streamCreateInputSchema.parse(input), streamSchema);
}

export async function updateStream(input: StreamUpdateInput): Promise<StreamDto> {
  return trpcMutation('streams.update', streamUpdateInputSchema.parse(input), streamSchema);
}

export async function triggerStream(id: string): Promise<StreamRunDto> {
  return trpcMutation('streams.trigger', streamTriggerInputSchema.parse({ id }), streamRunSchema);
}

export async function listStreamRuns(streamId: string, limit = 20): Promise<StreamRunDto[]> {
  return trpcQuery(
    'streams.runs',
    streamRunsInputSchema.parse({ streamId, limit }),
    z.array(streamRunSchema)
  );
}
