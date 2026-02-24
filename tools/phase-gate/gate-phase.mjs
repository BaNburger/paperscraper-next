import { parseArgs, runCommand } from '../lib/common.mjs';
import { getPhaseGate } from './core.mjs';

const args = parseArgs(process.argv.slice(2));
const phase = args.phase;
const changedOnly = Boolean(args['changed-only']);

if (!phase) {
  console.error('Usage: npm run gate:phase -- --phase=<PHASE_ID> [--changed-only]');
  process.exit(1);
}

const gate = getPhaseGate(phase);
if (!gate) {
  console.error(`No phase gate entry found for phase '${phase}'.`);
  process.exit(1);
}

if (changedOnly) {
  console.log(`[gate:phase] --changed-only requested for ${phase}; full gate still enforced.`);
}

const baseline = [
  'npm run lint:agents',
  'npm run lint:docs',
  `npm run lint:phase -- --phase=${phase}`,
  'npm run check:touched:backend',
  'npm run check:touched:frontend',
];

const commands = [...new Set([...baseline, ...gate.required_commands, ...gate.required_tests])];

for (const command of commands) {
  runCommand(command, { context: phase });
}

console.log(`[gate:phase] ${phase} passed.`);
console.log('[gate:phase] evidence checklist:');
for (const item of gate.evidence) {
  console.log(`- ${item}`);
}
