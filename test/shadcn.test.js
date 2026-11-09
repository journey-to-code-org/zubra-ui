// The promise on the box: a project installs Zubra UI components with the shadcn CLI, builds them
// with its own tooling, and they work. Each test makes a fresh project, runs the real
// `npx shadcn add <url>` against dist/r/ (served on 4174, the URL the build writes), installs, builds
// with Vite and uses the components in Chromium.
//
// Slow (npm installs): about a minute per project.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHADCN = 'shadcn@4.23.0';
const VERSIONS = { vite: '8.3.6', react: '19.3.1', 'react-dom': '19.3.1', '@vitejs/plugin-react': '6.2.1' };
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

let registry;
let browser;
const projects = [];
const sites = []; // closed in after(), so a failed test can't keep the process alive
before(async () => {
  assert.ok(existsSync(join(root, 'dist/r/registry.json')), 'run node scripts/build.mjs first (npm test does)');
  registry = await serve(join(root, 'dist'), 4174);
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  registry?.close();
  for (const site of sites) site.close();
  for (const dir of projects) rmSync(dir, { recursive: true, force: true });
});

function project(name, files) {
  const dir = mkdtempSync(join(tmpdir(), `zubra-ui-${name}-`));
  projects.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
// Asynchronous on purpose: the registry is served from this process, so a synchronous child would
// block the server it's downloading from.
const exec = promisify(execFile);
const run = async (command, args, cwd) => (await exec(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 1 << 26 })).stdout;
const add = (dir, ...names) => run(npx, ['-y', SHADCN, 'add', ...names.map((name) => `${registry.url}/r/${name}.json`), '--yes'], dir);

async function open(dir) {
  await run(npx, ['vite', 'build', '--logLevel', 'error'], dir);
  const site = await serve(join(dir, 'dist'));
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  sites.push(site);
  await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
  return { page, problems, close: async () => { await page.close(); site.close(); } };
}

// Once the component's transitions have finished (the toggle's track fades to its new colour).
const color = (page, selector, property) => page.locator(selector).first().evaluate(async (el, property) => {
  await Promise.all(el.getAnimations().map((animation) => animation.finished));
  return getComputedStyle(el)[property];
}, property);
/** A CSS colour as the browser resolves it (a minifier may rewrite `oklch(0.21 …)` as `oklch(21% …)`). */
const resolved = (page, css) => page.evaluate((css) => {
  const probe = document.createElement('i');
  probe.style.color = css;
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}, css);

test('plain HTML and Vite: shadcn installs the components, their runtime and the theme', async () => {
  const dir = project('plain', {
    'package.json': JSON.stringify({ name: 'plain', private: true, type: 'module' }),
    'index.html': `<!doctype html><html lang="en"><body>
      <toggle-switch label="Email me" name="email"></toggle-switch>
      <tab-list id="tabs"></tab-list>
      <script type="module" src="/main.js"></script></body></html>`,
    'main.js': `import './src/components/zubra/theme.css';
      import './src/components/zubra/toggle-switch.js';
      import './src/components/zubra/tab-list.js';
      document.querySelector('#tabs').tabs = [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }];`,
  });
  await add(dir, 'toggle-switch', 'tab-list');
  for (const file of ['src/components/zubra/toggle-switch.js', 'src/components/zubra/tab-list.js', 'src/components/zubra/theme.css']) {
    assert.ok(existsSync(join(dir, file)), `${file} written`);
  }
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  assert.match(pkg.dependencies['@zubra/runtime'], /^\^5\./, 'the runtime is a dependency');
  await run(npm, ['install', '--no-audit', '--no-fund', `vite@${VERSIONS.vite}`], dir);

  const { page, problems, close } = await open(dir);
  await page.waitForSelector('toggle-switch [role=switch]');
  const toggle = 'toggle-switch [role=switch]';
  assert.equal(await page.getAttribute(toggle, 'aria-checked'), 'false');
  await page.click(toggle);
  assert.equal(await page.getAttribute(toggle, 'aria-checked'), 'true');
  // The theme's --primary (shadcn's zinc, oklch(0.21 0.006 285.885)) colours the checked track.
  const zinc = await resolved(page, 'oklch(0.21 0.006 285.885)');
  assert.equal(await resolved(page, 'var(--primary)'), zinc);
  assert.equal(await color(page, 'toggle-switch [aria-checked=true] .track', 'backgroundColor'), zinc);
  // Tabs: arrow keys move between them (the component's own keyboard handling).
  await page.waitForSelector('tab-list [role=tab]');
  await page.focus('tab-list [role=tab][aria-selected=true]');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('tab-list [role=tab][data-value=two]', 'aria-selected'), 'true');
  assert.deepEqual(problems, []);
  await close();
});

test('React 19 and Vite: the same install, used as custom elements in JSX', async () => {
  const dir = project('react', {
    'package.json': JSON.stringify({ name: 'react-app', private: true, type: 'module' }),
    'vite.config.js': `import react from '@vitejs/plugin-react';\nexport default { plugins: [react()] };\n`,
    'index.html': `<!doctype html><html lang="en" class="dark"><body><div id="root"></div><script type="module" src="/main.jsx"></script></body></html>`,
    'main.jsx': `import { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import './src/components/zubra/theme.css';
      import './src/components/zubra/star-rating.js';
      function App() {
        const [stars, setStars] = useState(2);
        return <main>
          <star-rating label="Rating" value={stars} onvaluechange={(event) => setStars(event.detail)}></star-rating>
          <p id="stars">{stars} stars</p>
        </main>;
      }
      createRoot(document.getElementById('root')).render(<App />);`,
  });
  await add(dir, 'star-rating');
  await run(npm, ['install', '--no-audit', '--no-fund', ...Object.entries(VERSIONS).map(([name, version]) => `${name}@${version}`)], dir);

  const { page, problems, close } = await open(dir);
  await page.waitForSelector('star-rating button');
  assert.equal(await page.textContent('#stars'), '2 stars');
  await page.click('star-rating button[aria-label="4 of 5"]');
  // React re-renders after the event's state update, so wait for it.
  await page.waitForFunction(() => document.querySelector('#stars').textContent === '4 stars', null, { timeout: 5000 }).catch(() => {});
  assert.equal(await page.textContent('#stars'), '4 stars', 'the component\'s event reaches React state');
  // class="dark" on <html>: the theme's dark values.
  assert.equal(await resolved(page, 'var(--background)'), await resolved(page, 'oklch(0.141 0.005 285.823)'));
  assert.deepEqual(problems, []);
  await close();
});

test('the .zb source item installs the component for editing', async () => {
  const dir = project('source', { 'package.json': JSON.stringify({ name: 'source', private: true, type: 'module' }) });
  await add(dir, 'src/toggle-switch');
  const source = readFileSync(join(dir, 'src/components/toggle-switch.zb'), 'utf8');
  assert.match(source, /<toggle-switch/);
  assert.match(source, /var\(--primary/, 'on shadcn\'s variable names');
});

test('a block installs with the components it is made of, and works', async () => {
  const dir = project('block', {
    'package.json': JSON.stringify({ name: 'block', private: true, type: 'module' }),
    'index.html': `<!doctype html><html lang="en"><body><settings-block></settings-block><script type="module" src="/main.js"></script></body></html>`,
    'main.js': `import './src/components/zubra/theme.css';
      import './src/components/zubra/settings-block.js';
      const settings = document.querySelector('settings-block');
      settings.notifications = [{ id: 'digest', label: 'Weekly summary' }];
      settings.addEventListener('save', (event) => { document.title = JSON.stringify(event.detail); });`,
  });
  await add(dir, 'settings-block');
  for (const name of ['settings-block', 'toggle-switch', 'segmented-control', 'modal-dialog', 'theme']) {
    assert.ok(existsSync(join(dir, `src/components/zubra/${name}.${name === 'theme' ? 'css' : 'js'}`)), `${name} came with it`);
  }
  await run(npm, ['install', '--no-audit', '--no-fund', `vite@${VERSIONS.vite}`], dir);
  const { page, problems, close } = await open(dir);
  await page.getByLabel('Name').fill('Sam');
  await page.getByRole('switch', { name: 'Weekly summary' }).click();
  await page.getByRole('button', { name: 'Dark' }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  assert.deepEqual(JSON.parse(await page.title()), { name: 'Sam', email: '', notifications: { digest: true }, theme: 'dark' });
  await page.getByRole('button', { name: 'Delete account…' }).click();
  assert.equal(await page.locator('modal-dialog dialog').evaluate((dialog) => dialog.open), true, 'the dialog it brought works');
  assert.deepEqual(problems, []);
  await close();

  // The .zb source of a block brings its children's sources, which its imports need.
  const source = project('block-source', { 'package.json': JSON.stringify({ name: 'block-source', private: true, type: 'module' }) });
  await add(source, 'src/settings-block');
  for (const name of ['settings-block', 'toggle-switch', 'segmented-control', 'modal-dialog']) {
    assert.ok(existsSync(join(source, `src/components/${name}.zb`)), `${name}.zb came with it`);
  }
});

test('the one-file item installs a plain element that runs with nothing installed and no build', async () => {
  const dir = project('one-file', {
    'package.json': JSON.stringify({ name: 'one-file', private: true, type: 'module' }),
    // No bundler: the page loads the files as they were written.
    'index.html': `<!doctype html><html lang="en"><head><link rel="stylesheet" href="/src/components/zubra/theme.css"></head><body>
      <signin-block></signin-block>
      <script type="module" src="/src/components/zubra/signin-block.js"></script></body></html>`,
  });
  await add(dir, 'element/signin-block');
  for (const name of ['signin-block', 'toggle-switch']) {
    assert.ok(existsSync(join(dir, `src/components/zubra/${name}.js`)), `${name} written`);
    assert.doesNotMatch(readFileSync(join(dir, `src/components/zubra/${name}.js`), 'utf8'), /from ["']@zubra\/runtime["']/, `${name} imports no runtime`);
  }
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), [], 'nothing to install');
  const site = await serve(dir);
  sites.push(site);
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  await page.goto(`${site.url}/`, { waitUntil: 'networkidle' });
  const toggle = page.locator('signin-block toggle-switch [role=switch]');
  const before = await toggle.getAttribute('aria-checked');
  await toggle.click();
  assert.notEqual(await toggle.getAttribute('aria-checked'), before, 'its toggle works');
  assert.ok(await page.evaluate(() => Object.getPrototypeOf(customElements.get('signin-block')) === HTMLElement), 'a plain class on HTMLElement');
  assert.deepEqual(problems, []);
  await page.close();
});

test('a theme installs as one CSS file, scoped to its data-theme', async () => {
  const dir = project('theme', { 'package.json': JSON.stringify({ name: 'theme', private: true, type: 'module' }) });
  await add(dir, 'themes/paper');
  const css = readFileSync(join(dir, 'src/components/zubra/themes/paper.css'), 'utf8');
  assert.match(css, /^\[data-theme="paper"\] \{/m);
  assert.match(css, /--primary:/);
});

// An app that already uses shadcn/ui: Tailwind 4 (with its preflight reset), components.json, and
// its own theme. Zubra UI installs beside it without touching any of that, takes the app's theme,
// keeps its own look under the reset, and leaks nothing onto the app's own elements.
// In a project with components.json the CLI fetches the base colour from ui.shadcn.com, so this one
// needs the internet (CI has it; a sandbox may not).
const shadcnReachable = await fetch('https://ui.shadcn.com/r/colors/neutral.json', { signal: AbortSignal.timeout(8000) }).then((response) => response.ok, () => false);
test('in an existing shadcn/ui + Tailwind app: installs beside it, uses its theme, and keeps out of its way', { skip: !shadcnReachable && 'ui.shadcn.com is not reachable from here' }, async () => {
  const blue = 'oklch(0.546 0.245 262.881)';
  const components = JSON.stringify({ $schema: 'https://ui.shadcn.com/schema.json', style: 'new-york', rsc: false, tsx: true, tailwind: { config: '', css: 'src/index.css', baseColor: 'neutral', cssVariables: true }, aliases: { components: '@/components', utils: '@/lib/utils', ui: '@/components/ui' } }, null, 2);
  const css = `@import "tailwindcss";\n\n:root {\n  --radius: 0.5rem;\n  --background: oklch(1 0 0);\n  --foreground: oklch(0.145 0 0);\n  --primary: ${blue};\n  --primary-foreground: oklch(0.985 0 0);\n  --border: oklch(0.922 0 0);\n  --input: oklch(0.922 0 0);\n  --ring: oklch(0.708 0 0);\n  --muted-foreground: oklch(0.556 0 0);\n}\n\n@theme inline {\n  --color-primary: var(--primary);\n  --color-primary-foreground: var(--primary-foreground);\n}\n`;
  const dir = project('existing-shadcn', {
    'package.json': JSON.stringify({ name: 'existing-shadcn', private: true, type: 'module' }),
    'components.json': components,
    'tsconfig.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['./src/*'] }, jsx: 'react-jsx', module: 'esnext', moduleResolution: 'bundler', target: 'es2022' } }),
    'vite.config.js': "import react from '@vitejs/plugin-react';\nimport tailwindcss from '@tailwindcss/vite';\nexport default { plugins: [react(), tailwindcss()] };\n",
    'src/index.css': css,
    'index.html': '<!doctype html><html lang="en"><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>',
    'src/main.jsx': `import { createRoot } from 'react-dom/client';
import './index.css';
import './components/zubra/toggle-switch.js';
import './components/zubra/action-button.js';
createRoot(document.getElementById('root')).render(<main className="p-8">
  <button id="app-button" className="bg-primary text-primary-foreground rounded-md px-4 py-2">The app's own button</button>
  <button id="plain-button">An unstyled app button</button>
  <toggle-switch label="Email me" checked={true}></toggle-switch>
  <action-button>Zubra button</action-button>
</main>);
`,
  });
  await add(dir, 'toggle-switch', 'action-button');
  assert.equal(readFileSync(join(dir, 'components.json'), 'utf8'), components, 'components.json untouched');
  assert.equal(readFileSync(join(dir, 'src/index.css'), 'utf8'), css, "the app's theme untouched");
  for (const file of ['src/components/zubra/toggle-switch.js', 'src/components/zubra/action-button.js']) assert.ok(existsSync(join(dir, file)), `${file} written`);
  assert.ok(!existsSync(join(dir, 'src/components/ui/toggle-switch.js')), "nothing in the app's ui folder");
  await run(npm, ['install', '--no-audit', '--no-fund', `vite@${VERSIONS.vite}`, `react@${VERSIONS.react}`, `react-dom@${VERSIONS['react-dom']}`, `@vitejs/plugin-react@${VERSIONS['@vitejs/plugin-react']}`, 'tailwindcss@4.3.5', '@tailwindcss/vite@4.3.5'], dir);

  const { page, problems, close } = await open(dir);
  await page.waitForSelector('action-button button');
  const primary = await resolved(page, blue);
  assert.equal(await color(page, 'toggle-switch [aria-checked=true] .track', 'backgroundColor'), primary, "the toggle takes the app's --primary");
  assert.equal(await color(page, 'action-button button', 'backgroundColor'), primary, 'and so does the button');
  assert.equal(await color(page, '#app-button', 'backgroundColor'), primary, "the app's Tailwind classes still work");
  // Tailwind's reset zeroes button padding; the component's own styles still apply.
  assert.ok((await page.locator('action-button button').evaluate((button) => parseFloat(getComputedStyle(button).paddingLeft))) > 8, 'keeps its padding under the reset');
  assert.equal(await color(page, '#plain-button', 'backgroundColor'), 'rgba(0, 0, 0, 0)', "the app's other buttons get none of the component's styles");
  assert.deepEqual(problems, []);
  await close();
});
