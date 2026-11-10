// Copies polyfill/presence.js into every component that pastes it, replacing the block between
// its marker comments: `node polyfill/paste.mjs` after changing presence.js.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const START = '  // ---- motion polyfill';
const END = '// ---- end of the motion polyfill';
const block = readFileSync(join(root, 'polyfill/presence.js'), 'utf8').trimEnd().split('\n').map((line) => (line ? `  ${line}` : '')).join('\n');
for (const file of readdirSync(join(root, 'components')).filter((name) => name.endsWith('.zb'))) {
  const path = join(root, 'components', file);
  const source = readFileSync(path, 'utf8');
  const start = source.indexOf(START);
  if (start < 0) continue;
  const end = source.indexOf(END, start) + END.length;
  writeFileSync(path, source.slice(0, start) + block + source.slice(end));
  console.log(`pasted into ${file}`);
}
