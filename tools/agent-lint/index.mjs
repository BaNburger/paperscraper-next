import fs from 'node:fs';
import path from 'node:path';
import {
  collectFiles,
  normalizeRel,
  parseArgs,
  projectRoot,
  readFile,
  readJsonLikeYaml,
} from '../lib/common.mjs';

const RULE_REQUIRED_FIELDS = [
  'id',
  'description',
  'severity',
  'scope',
  'matcher',
  'autofix',
  'allowlistable',
];

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.sql']);

const RULE_REGEXES = {
  PSN001: [/PSN001_VIOLATION/g, /fetch\(/g, /axios\./g, /requests\./g, /httpx\./g],
  PSN002: [/PSN002_VIOLATION/g, /router[^\n]*\b(db\.|prisma\.|SELECT\s)/g],
  PSN003: [/PSN003_VIOLATION/g, /from ['\"]\.\.\/.*engine/g],
  PSN004: [/PSN004_VIOLATION/g],
  PSN005: [/PSN005_VIOLATION/g],
  PSN006: [/PSN006_VIOLATION/g],
  PSN007: [/PSN007_VIOLATION/g],
  PSN008: [/PSN008_VIOLATION/g, /eval\(/g, /child_process\.exec\(/g, /subprocess\./g],
  PSN009: [/PSN009_VIOLATION/g, /SELECT \*/gi],
  PSN010: [/PSN010_VIOLATION/g],
  PSN011: [/PSN011_VIOLATION/g, /if\s*\([^\)]*persona/gi],
  PSN012: [/PSN012_VIOLATION/g],
  PSN013: [/PSN013_VIOLATION/g],
  PSN014: [/PSN014_VIOLATION/g],
  PSN015: [/PSN015_VIOLATION/g],
  PSN016: [/PSN016_VIOLATION/g],
};

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = projectRoot();
  const errors = [];

  const rulesPath = path.join(root, 'config', 'agent-lint-rules.yaml');
  const allowlistPath = path.join(root, '.agent-lint-allowlist.yaml');

  const rulesConfig = readJsonLikeYaml(rulesPath);
  const allowlist = readJsonLikeYaml(allowlistPath) || [];

  validateRulesConfig(rulesConfig, errors);
  validateAllowlist(allowlist, errors);

  if (!rulesConfig || !Array.isArray(rulesConfig.rules)) {
    printErrorsAndExit(errors, 'lint:agents failed');
    return;
  }

  const findings = scanRepo(root, rulesConfig.rules, { includeFixtures: false });
  const activeFindings = findings.filter((finding) => !isAllowlisted(finding, allowlist));

  for (const finding of activeFindings) {
    errors.push(
      `${finding.path}:${finding.line} [${finding.rule_id}] ${finding.message} | ${finding.lineText.trim()}`
    );
  }

  const fixtureErrors = validateFixtures(root, rulesConfig.rules);
  errors.push(...fixtureErrors);

  if (args['fixtures-only']) {
    if (fixtureErrors.length > 0) {
      printErrorsAndExit(fixtureErrors, 'lint:agents fixture validation failed');
    }
    console.log('lint:agents fixtures validation passed.');
    return;
  }

  if (errors.length > 0) {
    printErrorsAndExit(errors, 'lint:agents failed');
  }

  console.log(`lint:agents passed (${rulesConfig.rules.length} rules validated).`);
}

function validateRulesConfig(config, errors) {
  if (!config || !Array.isArray(config.rules)) {
    errors.push('config/agent-lint-rules.yaml must define a rules array.');
    return;
  }

  const seen = new Set();
  for (const rule of config.rules) {
    for (const field of RULE_REQUIRED_FIELDS) {
      if (!(field in rule)) {
        errors.push(`agent rule '${rule.id || 'unknown'}' missing field '${field}'.`);
      }
    }

    if (seen.has(rule.id)) {
      errors.push(`duplicate rule id '${rule.id}' in config/agent-lint-rules.yaml.`);
    }
    seen.add(rule.id);

    if (!RULE_REGEXES[rule.id]) {
      errors.push(`rule '${rule.id}' has no matcher implementation in tools/agent-lint/index.mjs.`);
    }
  }
}

function validateAllowlist(allowlist, errors) {
  if (!Array.isArray(allowlist)) {
    errors.push('.agent-lint-allowlist.yaml must be a JSON-like array.');
    return;
  }

  const required = ['rule_id', 'path', 'match', 'reason', 'owner', 'expires_on'];
  const now = new Date();

  for (const entry of allowlist) {
    for (const key of required) {
      if (!(key in entry)) {
        errors.push(`allowlist entry missing '${key}'.`);
      }
    }

    if (entry.expires_on) {
      const expiresAt = new Date(`${entry.expires_on}T23:59:59Z`);
      if (Number.isNaN(expiresAt.getTime())) {
        errors.push(`allowlist entry for '${entry.rule_id}' has invalid expires_on '${entry.expires_on}'.`);
      } else if (expiresAt < now) {
        errors.push(`allowlist entry for '${entry.rule_id}' is expired (${entry.expires_on}).`);
      }
    }
  }
}

function scanRepo(root, rules, options = {}) {
  const includeFixtures = options.includeFixtures || false;
  const files = collectFiles(
    root,
    (fullPath, relPath) => {
      if (relPath.startsWith('tools/agent-lint/') && !includeFixtures) {
        return false;
      }
      const ext = path.extname(fullPath);
      return CODE_EXTENSIONS.has(ext);
    },
    { ignoreDirs: ['node_modules', '.git'] }
  );

  const findings = [];

  for (const filePath of files) {
    const relPath = normalizeRel(root, filePath);
    const content = readFile(filePath);

    for (const rule of rules) {
      findings.push(...scanRule(rule.id, content, relPath));
    }

    findings.push(...scanComplexityRules(content, relPath));
  }

  return findings;
}

function scanRule(ruleId, content, relPath) {
  const findings = [];
  const matchers = RULE_REGEXES[ruleId] || [];

  for (const regex of matchers) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const { line, lineText } = locate(content, match.index);
      findings.push({
        rule_id: ruleId,
        path: relPath,
        line,
        lineText,
        message: `Matched pattern ${regex}`,
      });
      if (match.index === regex.lastIndex) {
        regex.lastIndex += 1;
      }
    }
  }

  return findings;
}

function scanComplexityRules(content, relPath) {
  const findings = [];
  const lines = content.split(/\r?\n/);

  if (lines.length > 350) {
    findings.push({
      rule_id: 'PSN007',
      path: relPath,
      line: 1,
      lineText: lines[0] || '',
      message: `File has ${lines.length} lines (max 350).`,
    });
  }

  const functionMatches = content.match(/\bfunction\b|=>/g);
  const functionCount = functionMatches ? functionMatches.length : 0;
  if (functionCount > 40) {
    findings.push({
      rule_id: 'PSN010',
      path: relPath,
      line: 1,
      lineText: lines[0] || '',
      message: `File has ${functionCount} function markers (max 40).`,
    });
  }

  return findings;
}

function locate(content, index) {
  const prefix = content.slice(0, index);
  const lines = prefix.split(/\r?\n/);
  const line = lines.length;
  const lineText = content.split(/\r?\n/)[line - 1] || '';
  return { line, lineText };
}

function isAllowlisted(finding, allowlist) {
  for (const entry of allowlist) {
    if (entry.rule_id !== finding.rule_id) {
      continue;
    }
    if (!finding.path.includes(entry.path)) {
      continue;
    }
    if (entry.match && !finding.lineText.includes(entry.match)) {
      continue;
    }
    return true;
  }
  return false;
}

function validateFixtures(root, rules) {
  const errors = [];
  const fixtureDir = path.join(root, 'tools', 'agent-lint', 'fixtures', 'violations');

  for (const rule of rules) {
    const fixturePath = path.join(fixtureDir, `${rule.id}.fixture.ts`);
    if (!fs.existsSync(fixturePath)) {
      errors.push(`missing fixture file for ${rule.id}: ${normalizeRel(root, fixturePath)}`);
      continue;
    }

    const content = readFile(fixturePath);
    const findings = scanRule(rule.id, content, normalizeRel(root, fixturePath));
    const complexFindings = scanComplexityRules(content, normalizeRel(root, fixturePath)).filter(
      (f) => f.rule_id === rule.id
    );

    if (findings.length === 0 && complexFindings.length === 0) {
      errors.push(`fixture for ${rule.id} did not trigger a violation.`);
    }
  }

  return errors;
}

function printErrorsAndExit(errors, title) {
  console.error(`${title}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

main();
