import path from 'node:path';
import { projectRoot, readJsonLikeYaml } from '../lib/common.mjs';

const REQUIRED_FIELDS = ['phase_id', 'required_commands', 'required_tests', 'evidence'];

export function loadPhaseGates() {
  const root = projectRoot();
  const configPath = path.join(root, 'config', 'phase-gates.yaml');
  const config = readJsonLikeYaml(configPath);

  if (!config || !Array.isArray(config.phase_gates)) {
    throw new Error('config/phase-gates.yaml must define phase_gates array.');
  }

  const seen = new Set();
  for (const gate of config.phase_gates) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in gate)) {
        throw new Error(`Phase gate '${gate.phase_id || 'unknown'}' missing field '${field}'.`);
      }
    }

    if (seen.has(gate.phase_id)) {
      throw new Error(`Duplicate phase gate entry for '${gate.phase_id}'.`);
    }
    seen.add(gate.phase_id);

    if (!Array.isArray(gate.required_commands) || !Array.isArray(gate.required_tests) || !Array.isArray(gate.evidence)) {
      throw new Error(`Phase gate '${gate.phase_id}' must define required_commands/tests/evidence as arrays.`);
    }
  }

  return config.phase_gates;
}

export function getPhaseGate(phaseId) {
  const gates = loadPhaseGates();
  return gates.find((gate) => gate.phase_id === phaseId) || null;
}
