import path from 'node:path';
import { collectFiles, projectRoot, runCommand, runCommandCapture } from '../lib/common.mjs';

const root = projectRoot();

const pythonFiles = collectFiles(
  root,
  (fullPath, relPath) => fullPath.endsWith('.py') && !relPath.includes('node_modules'),
  { ignoreDirs: ['node_modules', '.git'] }
);

if (pythonFiles.length === 0) {
  console.log('[check:touched:backend] No Python backend files detected; skipping ruff/pytest.');
  process.exit(0);
}

const ruff = runCommandCapture('ruff', ['--version']);
if (ruff.status !== 0) {
  console.error('[check:touched:backend] ruff is required when Python files are present.');
  process.exit(1);
}

runCommand('ruff check .', { context: 'backend-lint' });
runCommand('ruff format --check .', { context: 'backend-format' });

const pytest = runCommandCapture('pytest', ['--version']);
const testDir = path.join(root, 'tests');
if (pytest.status === 0 && pythonFiles.some((f) => f.startsWith(testDir))) {
  runCommand('pytest -q', { context: 'backend-tests' });
} else {
  console.log('[check:touched:backend] No runnable backend test suite detected; skipping pytest.');
}

console.log('[check:touched:backend] passed.');
