import path from 'node:path';
import { fileExists, projectRoot, runCommand } from '../lib/common.mjs';

const root = projectRoot();
const candidates = ['apps/web', 'frontend'];

const workspaces = candidates
  .map((candidate) => ({
    dir: candidate,
    packageJson: path.join(root, candidate, 'package.json'),
  }))
  .filter((item) => fileExists(item.packageJson));

if (workspaces.length === 0) {
  console.log('[check:touched:frontend] No frontend workspace detected; skipping frontend checks.');
  process.exit(0);
}

for (const workspace of workspaces) {
  runCommand(`npm --prefix ${workspace.dir} run lint --if-present`, { context: `frontend-lint:${workspace.dir}` });
  runCommand(`npm --prefix ${workspace.dir} run test --if-present`, { context: `frontend-test:${workspace.dir}` });
}

console.log('[check:touched:frontend] passed.');
