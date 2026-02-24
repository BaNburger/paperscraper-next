import { validateDocs } from './core.mjs';

const result = validateDocs();

if (!result.ok) {
  console.error('lint:docs failed:');
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`lint:docs passed (${result.phasePackets.length} phase packets validated).`);
