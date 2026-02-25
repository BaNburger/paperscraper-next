import type { HealthSnapshot } from '@paperscraper/shared';

interface SystemHealthReader {
  getHealthSnapshot(): Promise<HealthSnapshot>;
}

export interface TrpcContext {
  systemEngine: SystemHealthReader;
}
