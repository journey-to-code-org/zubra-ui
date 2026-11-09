// Slotted content that a framework keeps changing. In light DOM the host's children live inside the
// component's template, so when React or Vue add, remove or reorder children of the host, the
// component has to route that into its slot regions. These apps do exactly that, and the test
// checks every child lands (and leaves) where it should, on the runtime build and, with
// ZUBRA_UI_EMIT=vanilla, on the L5 spike's plain elements.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const root = join(import.meta.dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = promisify(execFile);
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const VERSIONS = { vite: '8.3.6', react: '19.3.1', 'react-dom': '19.3.1', '@vitejs/plugin-react': '6.2.1', vue: '3.5.45', '@vitejs/plugin-vue': '6.0.10', '@zubra/runtime': pkg.devDependencies['@zubra/runtime'] };
// ZUBRA_RUNTIME: a local @zubra/runtime (a path or a .tgz) to test instead of the published one.
if (process.env.ZUBRA_RUNTIME) VERSIONS['@zubra/runtime'] = process.env.ZUBRA_RUNTIME;

// The same app in both: a sidebar-layout whose main content and sidebar change, and a
// modal-dialog's heading slot that appears and goes (its fallback shows meanwhile).
const page = (entry) => `<!doctype html><html lang="en"><body><div id="app"></div><script type="module" src="/src/${entry}"></script></body></html>`;
const files = {
  'package.json': JSON.stringify({ name: 'slots', private: true, type: 'module' }),
  'vite.config.js': `import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
export default {
  plugins: [react({ include: /\\.jsx$/ }), vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.includes('-') } } })],
  // The Vue app's template is a string, compiled in the browser: Vue's full build.
  resolve: { alias: { vue: 'vue/dist/vue.esm-bundler.js' } },
  build: { rollupOptions: { input: { react: 'react.html', vue: 'vue.html' } } },
};
`,
  'react.html': page('react.jsx'),
  'vue.html': page('vue.js'),
  'src/react.jsx': `import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import './components/zubra/sidebar-layout.js';
import './components/zubra/accordion-panel.js';
function App() {
  const [items, setItems] = useState(['one', 'two', 'three']);
  const [extra, setExtra] = useState(false);
  const [heading, setHeading] = useState(true);
  window.app = { reverse: () => setItems((list) => [...list].reverse()), drop: () => setItems((list) => list.slice(1)), extra: setExtra, heading: setHeading, rename: () => setItems((list) => list.map((item) => item.toUpperCase())) };
  return <>
    <sidebar-layout side="8rem">
      <nav slot="side" id="side">Side</nav>
      {items.map((item) => <p key={item} className="item">{item}</p>)}
      {extra && <p id="extra">Extra</p>}
    </sidebar-layout>
    <accordion-panel open={true}>
      {heading && <span slot="heading" id="heading">Given heading</span>}
      <p id="body">Body</p>
    </accordion-panel>
  </>;
}
createRoot(document.getElementById('app')).render(<App />);
`,
  'src/vue.js': `import { createApp, ref } from 'vue';
import './components/zubra/sidebar-layout.js';
import './components/zubra/accordion-panel.js';
createApp({
  setup() {
    const items = ref(['one', 'two', 'three']);
    const extra = ref(false);
    const heading = ref(true);
    window.app = { reverse: () => { items.value = [...items.value].reverse(); }, drop: () => { items.value = items.value.slice(1); }, extra: (on) => { extra.value = on; }, heading: (on) => { heading.value = on; }, rename: () => { items.value = items.value.map((item) => item.toUpperCase()); } };
    return { items, extra, heading };
  },
  template: \`<sidebar-layout side="8rem">
      <nav slot="side" id="side">Side</nav>
      <p v-for="item in items" :key="item" class="item">{{ item }}</p>
      <p v-if="extra" id="extra">Extra</p>
    </sidebar-layout>
    <accordion-panel :open.prop="true">
      <span v-if="heading" slot="heading" id="heading">Given heading</span>
      <p id="body">Body</p>
    </accordion-panel>\`,
}).mount('#app');
`,
};

let dir, site, browser;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'zubra-ui-slots-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  cpSync(join(root, 'dist/modules'), join(dir, 'src/components/zubra'), { recursive: true });
  if (process.env.ZUBRA_UI_EMIT === 'vanilla') cpSync(join(root, 'dist/vanilla'), join(dir, 'src/components/zubra'), { recursive: true, filter: (path) => !path.endsWith('.json') });
  await run(npm, ['install', '--no-audit', '--no-fund', ...Object.entries(VERSIONS).map(([name, version]) => (/[\\/]/.test(version) ? version : `${name}@${version}`))], { cwd: dir, shell: process.platform === 'win32', maxBuffer: 1 << 26 });
  await run(process.execPath, [join(dir, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'error'], { cwd: dir, maxBuffer: 1 << 26 });
  site = await serve(join(dir, 'dist'));
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  site?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/** Where things are: the main region's items in order, and what's in each slot. */
const read = (page) => page.evaluate(() => {
  const main = document.querySelector('sidebar-layout .layout-main');
  const side = document.querySelector('sidebar-layout .layout-side');
  const heading = document.querySelector('accordion-panel summary, accordion-panel [class*=heading], accordion-panel h3') ?? document.querySelector('accordion-panel');
  return {
    main: [...main.querySelectorAll('p')].map((p) => p.textContent),
    side: side.textContent.trim(),
    strays: [...document.querySelector('sidebar-layout').children].filter((child) => !child.matches('.layout')).map((child) => child.outerHTML),
    heading: document.querySelector('#heading') ? 'given' : (heading.textContent.includes('Given heading') ? 'given' : 'fallback'),
    headingInPlace: !document.querySelector('#heading') || Boolean(document.querySelector('#heading').closest('accordion-panel details, accordion-panel')),
    body: Boolean(document.querySelector('accordion-panel #body')),
  };
});

for (const stack of ['react', 'vue']) {
  test(`${stack}: children added, removed, reordered and renamed land in the right slots`, async () => {
    const tab = await browser.newPage();
    const problems = [];
    tab.on('pageerror', (error) => problems.push(error.message));
    tab.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    await tab.goto(`${site.url}/${stack}.html`, { waitUntil: 'networkidle' });
    const step = async (action, ...args) => { await tab.evaluate(([action, args]) => window.app[action](...args), [action, args]); await tab.waitForTimeout(50); return read(tab); };
    let state = await read(tab);
    assert.deepEqual(state.main, ['one', 'two', 'three']);
    assert.equal(state.side, 'Side');
    assert.deepEqual(state.strays, [], 'nothing left outside the template');
    state = await step('extra', true);
    assert.deepEqual(state.main, ['one', 'two', 'three', 'Extra'], 'a child added later goes into the slot');
    state = await step('reverse');
    assert.deepEqual(state.main, ['three', 'two', 'one', 'Extra'], 'reordered in the slot');
    state = await step('drop');
    assert.deepEqual(state.main, ['two', 'one', 'Extra'], 'removed from the slot');
    state = await step('rename');
    assert.deepEqual(state.main, ['TWO', 'ONE', 'Extra']);
    state = await step('extra', false);
    assert.deepEqual(state.main, ['TWO', 'ONE']);
    assert.deepEqual(state.strays, []);
    assert.equal(state.body, true);
    state = await step('heading', false);
    assert.equal(state.heading, 'fallback', 'an emptied slot shows its fallback');
    state = await step('heading', true);
    assert.equal(state.heading, 'given', 'and the given content again when it comes back');
    assert.deepEqual(problems, []);
    await tab.close();
  });
}
