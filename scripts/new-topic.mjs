// Usage: npm run new -- <category>/<slug> "Title"
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [target, ...titleWords] = process.argv.slice(2);

if (!target || !/^[a-z0-9-]+(\/[a-z0-9-]+)+$/.test(target)) {
  console.error('Usage: npm run new -- <category>/<slug> "Title"   (lowercase, dashes, e.g. networking/osi-model)');
  process.exit(1);
}

const dir = path.join(root, 'content', target);
const file = path.join(dir, 'index.md');
if (fs.existsSync(file)) {
  console.error(`Already exists: content/${target}/index.md`);
  process.exit(1);
}

const title = titleWords.join(' ') || target.split('/').pop().replace(/-/g, ' ');
const date = new Date().toISOString().slice(0, 10);
const template = fs.readFileSync(path.join(root, 'templates', 'topic.md'), 'utf8');

fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(file, template.replaceAll('{{title}}', title).replaceAll('{{date}}', date));
fs.writeFileSync(path.join(dir, 'notes.md'), `# ${title}\n\nPaste your raw notes here.\n`);
console.log(`Created content/${target}/index.md and notes.md`);
