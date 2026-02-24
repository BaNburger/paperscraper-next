import fs from 'node:fs';
import path from 'node:path';
import {
  collectFiles,
  fileExists,
  normalizeRel,
  parseFrontmatter,
  projectRoot,
  readFile,
} from '../lib/common.mjs';

const REQUIRED_META_KEYS = [
  'phase_id',
  'stage',
  'depends_on',
  'owners',
  'status',
  'entry_gate',
  'exit_gate',
];

const REQUIRED_PHASE_SECTIONS = [
  'Context Capsule',
  'Entry Criteria',
  'Decisions Locked for This Phase',
  'Functional Requirements',
  'Non-Functional Requirements',
  'Public Interfaces and Data Contracts',
  'Out of Scope',
  'Implementation Constraints',
  'Acceptance Criteria',
  'Test Plan',
  'Exit Gate',
  'Deliverables',
];

const PHASE_ID_PATTERN = /S[12](?:\.(?:EXIT|\d|W\d))/;
const DEFINITION_ROW_REGEX = /^\|\s*(S[12](?:\.(?:EXIT|\d|W\d))-(?:REQ|NFR|AC)-\d{3})\s*\|\s*(REQ|NFR|AC)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/gm;

export function validateDocs({ phaseId } = {}) {
  const root = projectRoot();
  const packets = readPhasePackets(root);
  const errors = [];
  const idOwner = new Map();

  const selectedPackets = phaseId
    ? packets.filter((packet) => packet.meta.phase_id === phaseId)
    : packets;

  if (phaseId && selectedPackets.length === 0) {
    errors.push(`No phase packet found for phase '${phaseId}'.`);
    return { ok: false, errors, phasePackets: packets };
  }

  for (const packet of selectedPackets) {
    validatePhaseMeta(packet, errors);
    validateSectionOrder(packet, errors);
    validateRequirementTable(packet, errors, idOwner);
  }

  validateMarkdownLinks(root, errors);
  validateContradictions(root, errors);

  return {
    ok: errors.length === 0,
    errors,
    phasePackets: packets,
  };
}

export function readPhasePackets(root = projectRoot()) {
  const phasesDir = path.join(root, 'pm', 'phases');
  if (!fileExists(phasesDir)) {
    return [];
  }

  const files = collectFiles(
    phasesDir,
    (fullPath) => fullPath.endsWith('.md'),
    { ignoreDirs: [] }
  ).sort();

  return files.map((filePath) => {
    const content = readFile(filePath);
    const { meta, body } = parseFrontmatter(content);
    return {
      filePath,
      relPath: normalizeRel(root, filePath),
      meta,
      body,
      content,
    };
  });
}

function validatePhaseMeta(packet, errors) {
  if (!packet.meta) {
    errors.push(`${packet.relPath}: missing frontmatter.`);
    return;
  }

  for (const key of REQUIRED_META_KEYS) {
    if (!(key in packet.meta)) {
      errors.push(`${packet.relPath}: missing frontmatter key '${key}'.`);
    }
  }

  if (packet.meta.phase_id && !PHASE_ID_PATTERN.test(packet.meta.phase_id)) {
    errors.push(`${packet.relPath}: invalid phase_id '${packet.meta.phase_id}'.`);
  }

  if (packet.meta.depends_on && !Array.isArray(packet.meta.depends_on)) {
    errors.push(`${packet.relPath}: depends_on must be an array.`);
  }

  if (packet.meta.owners && !Array.isArray(packet.meta.owners)) {
    errors.push(`${packet.relPath}: owners must be an array.`);
  }
}

function validateSectionOrder(packet, errors) {
  const sectionNames = [...packet.body.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());

  if (sectionNames.length !== REQUIRED_PHASE_SECTIONS.length) {
    errors.push(
      `${packet.relPath}: expected ${REQUIRED_PHASE_SECTIONS.length} phase sections, found ${sectionNames.length}.`
    );
    return;
  }

  REQUIRED_PHASE_SECTIONS.forEach((expected, index) => {
    if (sectionNames[index] !== expected) {
      errors.push(
        `${packet.relPath}: section ${index + 1} must be '${expected}' but found '${sectionNames[index]}'.`
      );
    }
  });
}

function validateRequirementTable(packet, errors, globalIdOwner) {
  const definitions = [...packet.body.matchAll(DEFINITION_ROW_REGEX)].map((match) => ({
    id: match[1],
    type: match[2],
    text: match[3],
    mapsTo: match[4],
  }));

  if (definitions.length === 0) {
    errors.push(`${packet.relPath}: no requirement rows were found.`);
    return;
  }

  const localIds = new Set();
  const expectedPrefix = packet.meta?.phase_id || '';

  for (const def of definitions) {
    const idPrefix = def.id.split('-')[0];
    const idKind = def.id.split('-')[1];

    if (idPrefix !== expectedPrefix) {
      errors.push(
        `${packet.relPath}: requirement id '${def.id}' prefix does not match phase_id '${expectedPrefix}'.`
      );
    }

    if (idKind !== def.type) {
      errors.push(`${packet.relPath}: row type mismatch for '${def.id}' (expected ${idKind}, found ${def.type}).`);
    }

    if (localIds.has(def.id)) {
      errors.push(`${packet.relPath}: duplicate requirement id '${def.id}' in phase packet.`);
    }
    localIds.add(def.id);

    if (globalIdOwner.has(def.id) && globalIdOwner.get(def.id) !== packet.relPath) {
      errors.push(
        `${packet.relPath}: requirement id '${def.id}' already defined in ${globalIdOwner.get(def.id)}.`
      );
    } else {
      globalIdOwner.set(def.id, packet.relPath);
    }

    if (!def.text || def.text === '-') {
      errors.push(`${packet.relPath}: requirement '${def.id}' must include non-empty text.`);
    }
  }

  const hasReq = definitions.some((d) => d.type === 'REQ');
  const hasNfr = definitions.some((d) => d.type === 'NFR');
  const hasAc = definitions.some((d) => d.type === 'AC');

  if (!hasReq || !hasNfr || !hasAc) {
    errors.push(`${packet.relPath}: must contain REQ, NFR, and AC rows.`);
  }

  for (const def of definitions) {
    const mapsTo = (def.mapsTo || '').trim();

    if (def.type === 'REQ') {
      continue;
    }

    if (!mapsTo || mapsTo === '-') {
      errors.push(`${packet.relPath}: '${def.id}' must map to at least one requirement.`);
      continue;
    }

    const refs = mapsTo.split(',').map((x) => x.trim()).filter(Boolean);
    for (const ref of refs) {
      if (!localIds.has(ref)) {
        errors.push(`${packet.relPath}: '${def.id}' maps_to unknown id '${ref}'.`);
      }
    }
  }
}

function validateMarkdownLinks(root, errors) {
  const markdownFiles = collectFiles(
    root,
    (fullPath, relPath) => fullPath.endsWith('.md') && !relPath.startsWith('node_modules'),
    { ignoreDirs: ['node_modules', '.git'] }
  );

  const linkRegex = /\[[^\]]+\]\(([^)]+)\)/g;

  for (const filePath of markdownFiles) {
    const content = readFile(filePath);
    const relPath = normalizeRel(root, filePath);
    const matches = [...content.matchAll(linkRegex)];

    for (const match of matches) {
      let target = match[1].trim();
      if (!target || target.startsWith('#') || target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:')) {
        continue;
      }

      target = target.split('#')[0].split('?')[0];
      if (!target) {
        continue;
      }

      let resolved;
      if (path.isAbsolute(target)) {
        resolved = target;
      } else {
        resolved = path.resolve(path.dirname(filePath), target);
      }

      if (!fileExists(resolved)) {
        errors.push(`${relPath}: broken link target '${match[1]}'.`);
      }
    }
  }
}

function validateContradictions(root, errors) {
  const stageOneFiles = [
    path.join(root, 'pm', 'PRD.md'),
    path.join(root, 'pm', 'VISION.md'),
    path.join(root, 'pm', 'MVP_SCOPE.md'),
    ...collectFiles(path.join(root, 'pm', 'phases'), (fullPath, relPath) => {
      return fullPath.endsWith('.md') && relPath.startsWith('S1_');
    }, { ignoreDirs: [] }),
  ].filter(fileExists);

  for (const filePath of stageOneFiles) {
    const content = readFile(filePath);
    const relPath = normalizeRel(root, filePath);

    if (/\b9\s+pages\b/i.test(content)) {
      errors.push(`${relPath}: contains contradictory '9 pages' claim for Stage 1.`);
    }

    if (/\bcron\s+(?:schedule|job|trigger)\b/i.test(content)) {
      errors.push(`${relPath}: contains cron scheduling language conflicting with Stage 1 manual-only policy.`);
    }
  }

  const legacyPhaseFiles = collectFiles(
    path.join(root, 'claude-code'),
    (_fullPath, relPath) => /^PHASE_\d+_.+\.md$/.test(path.basename(relPath)),
    { ignoreDirs: [] }
  );

  for (const filePath of legacyPhaseFiles) {
    const content = readFile(filePath);
    const relPath = normalizeRel(root, filePath);

    if (!/Archive Stub/.test(content)) {
      errors.push(`${relPath}: legacy phase file must be an archive stub.`);
    }

    if (/LEGACY DRAFT/i.test(content)) {
      errors.push(`${relPath}: legacy draft marker should not remain after archive conversion.`);
    }
  }
}
