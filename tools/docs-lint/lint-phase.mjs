import { readJsonLikeYaml, parseArgs, projectRoot, fileExists } from '../lib/common.mjs';
import { validateDocs, readPhasePackets } from './core.mjs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const phase = args.phase;

if (!phase) {
  console.error('Usage: npm run lint:phase -- --phase=<PHASE_ID>');
  process.exit(1);
}

const result = validateDocs({ phaseId: phase });
const root = projectRoot();
const packets = readPhasePackets(root);
const packet = packets.find((p) => p.meta?.phase_id === phase);

if (!packet) {
  console.error(`No phase packet for phase '${phase}'.`);
  process.exit(1);
}

const runbookPath = path.join(root, 'agents', 'phases', `${phase}.md`);
if (!fileExists(runbookPath)) {
  result.errors.push(`Missing runbook: agents/phases/${phase}.md`);
}

const gateConfigPath = path.join(root, 'config', 'phase-gates.yaml');
const gateConfig = readJsonLikeYaml(gateConfigPath);
const gate = gateConfig?.phase_gates?.find((g) => g.phase_id === phase);
if (!gate) {
  result.errors.push(`Missing phase gate entry for '${phase}' in config/phase-gates.yaml`);
}

if (!result.ok || result.errors.length > 0) {
  console.error(`lint:phase failed for ${phase}:`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`lint:phase passed for ${phase}.`);
