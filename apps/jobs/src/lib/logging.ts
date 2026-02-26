import { z } from 'zod';

type JsonLogEntry = Record<string, unknown>;
type JsonLogger = ((entry: JsonLogEntry) => void) | undefined;

export function emitValidatedLog<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  payload: z.input<TSchema>,
  log: JsonLogger
): z.output<TSchema> {
  const parsed = schema.parse(payload);
  if (log) {
    log(parsed as JsonLogEntry);
    return parsed;
  }
  console.log(JSON.stringify(parsed));
  return parsed;
}
