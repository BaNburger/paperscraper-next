import { loadJobsEnv } from './config';
import { startJobsApp } from './runtime';

const env = loadJobsEnv();
const runtime = await startJobsApp(env).catch(() => process.exit(1));

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
