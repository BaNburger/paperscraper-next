import {
  ingestionRunLogSchema,
  type IngestionRunLog,
} from '@paperscraper/shared';

export function logIngestionRunEvent(
  log: ((entry: Record<string, unknown>) => void) | undefined,
  payload: Omit<IngestionRunLog, 'component'>
): void {
  const parsed = ingestionRunLogSchema.parse({
    component: 'jobs-worker',
    ...payload,
  });

  if (log) {
    log(parsed);
    return;
  }
  console.log(JSON.stringify(parsed));
}
