import {
  ingestionRunLogSchema,
  type IngestionRunLog,
} from '@paperscraper/shared';
import { emitValidatedLog } from '../lib/logging';

export function logIngestionRunEvent(
  log: ((entry: Record<string, unknown>) => void) | undefined,
  payload: Omit<IngestionRunLog, 'component'>
): void {
  emitValidatedLog(
    ingestionRunLogSchema,
    {
      component: 'jobs-worker',
      ...payload,
    },
    log
  );
}
