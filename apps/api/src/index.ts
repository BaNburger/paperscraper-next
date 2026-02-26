import { loadApiEnv } from './config';
import { startApiRuntime } from './runtime';

const env = loadApiEnv();
const runtime = startApiRuntime(env);

let shuttingDown = false;
async function shutdown(exitCode: number): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  await runtime.close();
  process.exit(exitCode);
}

process.on('SIGINT', async () => {
  await shutdown(0);
});

process.on('SIGTERM', async () => {
  await shutdown(0);
});

console.log(JSON.stringify(runtime.ready));
