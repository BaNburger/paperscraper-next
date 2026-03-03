import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from '../lib/common.mjs';

const BUDGETS = [
  { name: 'main', pattern: /^main-.*\.js$/, maxBytes: 370_000 },
  { name: 'framework', pattern: /^framework-.*\.js$/, maxBytes: 390_000 },
  { name: 'feed.lazy', pattern: /^feed\.lazy-.*\.js$/, maxBytes: 35_000 },
  { name: 'pipeline.lazy', pattern: /^pipeline\.lazy-.*\.js$/, maxBytes: 80_000 },
  { name: 'editor', pattern: /^editor-.*\.js$/, maxBytes: 1_600_000 },
  { name: 'api-client', pattern: /^api-client-.*\.js$/, maxBytes: 130_000 },
];

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(2)} KiB`;
}

function main() {
  const root = projectRoot();
  const assetDir = path.join(root, 'apps', 'web', 'dist', 'client', 'assets');
  if (!fs.existsSync(assetDir)) {
    console.error('[check-web-budgets] Missing build output at apps/web/dist/client/assets.');
    process.exit(1);
  }

  const assets = fs.readdirSync(assetDir);
  const errors = [];

  for (const budget of BUDGETS) {
    const match = assets.find((fileName) => budget.pattern.test(fileName));
    if (!match) {
      errors.push(`Missing asset for budget '${budget.name}'.`);
      continue;
    }

    const bytes = fs.statSync(path.join(assetDir, match)).size;
    console.log(
      `[check-web-budgets] ${budget.name}: ${formatSize(bytes)} (limit ${formatSize(
        budget.maxBytes
      )})`
    );

    if (bytes > budget.maxBytes) {
      errors.push(
        `${budget.name} exceeded budget: ${formatSize(bytes)} > ${formatSize(
          budget.maxBytes
        )}`
      );
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[check-web-budgets] ${error}`);
    }
    process.exit(1);
  }

  console.log('[check-web-budgets] passed.');
}

main();
