import { runCommand } from '../lib/common.mjs';

const STAGE_TWO_PHASES = ['S2.W1', 'S2.W2', 'S2.W3', 'S2.W4'];

for (const phase of STAGE_TWO_PHASES) {
  runCommand(`npm run gate:phase -- --phase=${phase}`, { context: 'stage2' });
}

console.log('[gate:stage2] passed.');
