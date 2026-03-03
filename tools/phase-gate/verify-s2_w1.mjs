import fs from 'node:fs';
import path from 'node:path';
import { projectRoot, runCommand } from '../lib/common.mjs';
import { assert, parseVerifyMode, runWorkspaceChecks } from './runtime-utils.mjs';

const REQUIRED_WORKSPACES = ['apps/api', 'apps/web', 'packages/shared', 'packages/db'];
const REQUIRED_ROUTE_FILES = new Set([
  '__root.tsx',
  'index.tsx',
  'feed.tsx',
  'feed.lazy.tsx',
  'pipeline.tsx',
  'pipeline.lazy.tsx',
  'objects.$objectId.tsx',
  'objects.$objectId.lazy.tsx',
  'entities.$entityId.tsx',
  'entities.$entityId.lazy.tsx',
]);

function verifyS2W1Packet(root) {
  const packetPath = path.join(root, 'pm', 'phases', 'S2_W1_UX_HARDENING.md');
  const content = fs.readFileSync(packetPath, 'utf8');
  assert(content.includes('S2.W1-REQ-006'), 'S2.W1 packet missing REQ-006.');
  assert(content.includes('S2.W1-REQ-007'), 'S2.W1 packet missing REQ-007.');
  assert(content.includes('S2.W1-REQ-008'), 'S2.W1 packet missing REQ-008.');
}

function verifyTopLevelIa(root) {
  const routesDir = path.join(root, 'apps', 'web', 'src', 'routes');
  const routeFiles = fs
    .readdirSync(routesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);

  for (const file of routeFiles) {
    assert(REQUIRED_ROUTE_FILES.has(file), `Unexpected top-level route file '${file}'.`);
  }
}

function verifyS2W1Surface(root) {
  const requiredPaths = [
    'packages/shared/src/contracts-s2_w1.ts',
    'apps/api/src/engines/workspace-engine.ts',
    'apps/api/src/providers/workspace-provider.ts',
    'apps/web/src/lib/api/workspace.ts',
  ];
  for (const relPath of requiredPaths) {
    assert(fs.existsSync(path.join(root, relPath)), `Missing required S2.W1 artifact: ${relPath}`);
  }
}

function main() {
  const root = projectRoot();
  const mode = parseVerifyMode(process.argv.slice(2), 'fast');

  runWorkspaceChecks(REQUIRED_WORKSPACES, 'verify-s2_w1');
  runCommand('npm --prefix apps/web run build', {
    context: 'verify-s2_w1:web-build',
  });
  runCommand('node tools/phase-gate/check-web-budgets.mjs', {
    context: 'verify-s2_w1:web-budgets',
  });

  verifyS2W1Packet(root);
  verifyTopLevelIa(root);
  verifyS2W1Surface(root);

  if (mode === 'runtime') {
    runCommand('node tools/phase-gate/verify-s1_4_ui.mjs --mode=fast', {
      context: 'verify-s2_w1:baseline-ui',
    });
  }

  console.log(`[verify-s2_w1] passed (mode=${mode}).`);
}

try {
  main();
} catch (error) {
  console.error(`[verify-s2_w1] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
