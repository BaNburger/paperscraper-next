import type { HealthSnapshot } from '@paperscraper/shared';
import type { StreamDto, StreamRunDto } from '@paperscraper/shared';

interface SystemHealthReader {
  getHealthSnapshot(): Promise<HealthSnapshot>;
}

interface StreamsReader {
  list(input: { includeInactive?: boolean }): Promise<StreamDto[]>;
  create(input: { name: string; query: string; maxObjects?: number }): Promise<StreamDto>;
  update(input: {
    id: string;
    name?: string;
    query?: string;
    maxObjects?: number;
    isActive?: boolean;
  }): Promise<StreamDto>;
  delete(input: { id: string }): Promise<StreamDto>;
  trigger(input: { id: string }): Promise<StreamRunDto>;
  runs(input: { streamId: string; limit?: number }): Promise<StreamRunDto[]>;
}

export interface TrpcContext {
  systemEngine: SystemHealthReader;
  streamsEngine: StreamsReader;
}
