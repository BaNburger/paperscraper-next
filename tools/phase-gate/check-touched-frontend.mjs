import { runCommand, runCommandCapture } from '../lib/common.mjs';

const FRONTEND_WORKSPACES = ['apps/web'];
const FULL_CHECK_TRIGGERS = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.base.json',
  '.env.example',
  'tools/',
  'config/',
];

function splitLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function runGit(args) {
  const result = runCommandCapture('git', args);
  if (result.status !== 0) {
    return null;
  }
  return splitLines(result.stdout || '');
}

function detectChangedPaths() {
  const inRepo = runGit(['rev-parse', '--is-inside-work-tree']);
  if (!inRepo || inRepo[0] !== 'true') {
    return null;
  }

  const staged = runGit(['diff', '--name-only', '--cached']);
  const unstaged = runGit(['diff', '--name-only']);
  const untracked = runGit(['ls-files', '--others', '--exclude-standard']);
  if (!staged || !unstaged || !untracked) {
    return null;
  }

  return Array.from(new Set([...staged, ...unstaged, ...untracked]));
}

function needsFullCheck(changedPaths) {
  return changedPaths.some((path) =>
    FULL_CHECK_TRIGGERS.some((trigger) =>
      trigger.endsWith('/') ? path.startsWith(trigger) : path === trigger
    )
  );
}

function selectWorkspaces(changedPaths) {
  if (needsFullCheck(changedPaths)) {
    return FRONTEND_WORKSPACES;
  }

  return FRONTEND_WORKSPACES.filter((workspace) =>
    changedPaths.some((path) => path.startsWith(`${workspace}/`))
  );
}

function runWorkspaceChecks(workspaces) {
  for (const workspace of workspaces) {
    runCommand(`npm --prefix ${workspace} run lint --if-present`, {
      context: `frontend-lint:${workspace}`,
    });
    runCommand(`npm --prefix ${workspace} run test --if-present`, {
      context: `frontend-test:${workspace}`,
    });
  }
}

const changedPaths = detectChangedPaths();
if (!changedPaths) {
  console.log('[check:touched:frontend] Could not resolve changed files; running frontend checks.');
  runWorkspaceChecks(FRONTEND_WORKSPACES);
  console.log('[check:touched:frontend] passed.');
  process.exit(0);
}

if (changedPaths.length === 0) {
  console.log('[check:touched:frontend] No changed files detected; skipping frontend checks.');
  process.exit(0);
}

const workspaces = selectWorkspaces(changedPaths);
if (workspaces.length === 0) {
  console.log('[check:touched:frontend] No frontend workspace changes detected; skipping frontend checks.');
  process.exit(0);
}

runWorkspaceChecks(workspaces);
console.log(`[check:touched:frontend] passed (${workspaces.join(', ')}).`);
