// Validates every topic: frontmatter, ```flow blocks, ```embed targets, and relative links.
// Usage: npm run check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { parseFlow } from '../src/flow-spec.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contentDir = path.join(root, 'content');

function findTopics(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return findTopics(full);
    return entry.name === 'index.md' ? [full] : [];
  });
}

let failures = 0;
const topics = findTopics(contentDir);

for (const file of topics) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  const dir = path.dirname(file);
  const raw = fs.readFileSync(file, 'utf8');
  const problems = [];
  const lineOf = index => raw.slice(0, index).split('\n').length;

  const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!front) problems.push('missing frontmatter (--- title: ... ---)');
  else {
    try {
      const meta = parse(front[1]) ?? {};
      if (typeof meta.title !== 'string') problems.push('frontmatter: `title` is required');
      if (meta.tags != null && !Array.isArray(meta.tags)) problems.push('frontmatter: `tags` must be a list');
      if (meta.source && !fs.existsSync(path.join(dir, meta.source))) problems.push(`frontmatter: source "${meta.source}" not found`);
    } catch (error) {
      problems.push(`frontmatter YAML: ${error.message}`);
    }
  }

  for (const block of raw.matchAll(/^```(flow|embed)\r?\n([\s\S]*?)^```/gm)) {
    const [, lang, body] = block;
    const at = `line ${lineOf(block.index)} (${lang})`;
    if (lang === 'flow') {
      for (const error of parseFlow(body).errors) problems.push(`${at}: ${error}`);
    } else {
      try {
        const spec = parse(body);
        const src = typeof spec === 'string' ? spec : spec?.src;
        if (!src) problems.push(`${at}: \`src\` is required`);
        else if (!/^https?:/.test(src) && !fs.existsSync(path.join(dir, src))) problems.push(`${at}: "${src}" not found`);
      } catch (error) {
        problems.push(`${at}: YAML: ${error.message}`);
      }
    }
  }

  // Relative images and links must exist in the topic folder.
  const withoutCode = raw.replace(/^```[\s\S]*?^```/gm, '');
  for (const link of withoutCode.matchAll(/!?\[[^\]]*\]\(([^)\s]+)\)|\b(?:src|href)="([^"]+)"/g)) {
    const target = (link[1] ?? link[2]).split('#')[0];
    if (!target || /^([a-z][a-z0-9+.-]*:|\/|#)/i.test(target)) continue;
    if (!fs.existsSync(path.join(dir, decodeURIComponent(target)))) problems.push(`link "${target}" not found in topic folder`);
  }

  if (problems.length) {
    failures++;
    console.log(`✗ ${rel}`);
    for (const problem of problems) console.log(`    ${problem}`);
  } else {
    console.log(`✓ ${rel}`);
  }
}

console.log(`\n${topics.length} topics, ${failures} with problems.`);
process.exit(failures ? 1 : 0);
