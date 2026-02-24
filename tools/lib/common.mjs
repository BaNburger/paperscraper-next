import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function projectRoot() {
  return process.cwd();
}

export function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

export function fileExists(filePath) {
  return fs.existsSync(filePath);
}

export function readJsonLikeYaml(filePath) {
  const raw = readFile(filePath);
  const withoutComments = raw
    .split(/\r?\n/)
    .map((line) => (line.trimStart().startsWith('#') ? '' : line))
    .join('\n')
    .trim();

  if (!withoutComments) {
    return null;
  }

  try {
    return JSON.parse(withoutComments);
  } catch (error) {
    throw new Error(`Could not parse JSON-like YAML file ${filePath}: ${error.message}`);
  }
}

export function parseFrontmatter(markdown) {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { meta: null, body: markdown };
  }

  const metaLines = [];
  let cursor = 1;
  while (cursor < lines.length && lines[cursor] !== '---') {
    metaLines.push(lines[cursor]);
    cursor += 1;
  }

  if (cursor >= lines.length) {
    throw new Error('Frontmatter start found without closing --- delimiter.');
  }

  const meta = parseSimpleYamlObject(metaLines);
  const body = lines.slice(cursor + 1).join('\n');
  return { meta, body };
}

function parseSimpleYamlObject(lines) {
  const result = {};
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line || !line.trim()) {
      index += 1;
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!keyMatch) {
      throw new Error(`Invalid frontmatter line: ${line}`);
    }

    const key = keyMatch[1];
    const inlineValue = keyMatch[2].trim();

    if (inlineValue) {
      result[key] = stripQuotes(inlineValue);
      index += 1;
      continue;
    }

    const values = [];
    index += 1;
    while (index < lines.length) {
      const listLine = lines[index];
      if (!listLine || !listLine.trim()) {
        index += 1;
        continue;
      }
      if (/^[A-Za-z0-9_]+:\s*/.test(listLine)) {
        break;
      }
      const itemMatch = listLine.match(/^\s*-\s*(.+)$/);
      if (!itemMatch) {
        throw new Error(`Invalid list item in frontmatter: ${listLine}`);
      }
      values.push(stripQuotes(itemMatch[1].trim()));
      index += 1;
    }
    result[key] = values;
  }

  return result;
}

function stripQuotes(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

export function collectFiles(rootDir, predicate, options = {}) {
  const { ignoreDirs = [] } = options;
  const output = [];

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      const rel = path.relative(rootDir, full);

      if (entry.isDirectory()) {
        if (ignoreDirs.includes(entry.name) || ignoreDirs.includes(rel)) {
          continue;
        }
        walk(full);
        continue;
      }

      if (predicate(full, rel)) {
        output.push(full);
      }
    }
  }

  walk(rootDir);
  return output;
}

export function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) {
      continue;
    }

    const [key, value] = item.slice(2).split('=');
    args[key] = value === undefined ? true : value;
  }
  return args;
}

export function runCommand(command, options = {}) {
  const result = spawnSync(command, {
    shell: true,
    stdio: 'inherit',
    cwd: options.cwd || process.cwd(),
    env: process.env,
  });

  if (result.status !== 0) {
    const suffix = options.context ? ` (${options.context})` : '';
    throw new Error(`Command failed${suffix}: ${command}`);
  }
}

export function runCommandCapture(binary, args = []) {
  const result = spawnSync(binary, args, {
    shell: false,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  return result;
}

export function normalizeRel(rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, '/');
}
