import { runCommand } from '../lib/common.mjs';

const STAGE_ONE_PHASES = ['S1.1', 'S1.2', 'S1.3', 'S1.4', 'S1.EXIT'];

for (const phase of STAGE_ONE_PHASES) {
  runCommand(`npm run gate:phase -- --phase=${phase}`, { context: 'stage1' });
}

console.log('[gate:stage1] passed.');
