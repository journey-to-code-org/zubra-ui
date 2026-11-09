// No build, no install: a page that loads components with <script> tags straight from the site
// (dist/cdn/, the plain elements with their one package import pointing at the site's runtime).
// No import map: anything still importing a bare package name would fail to load here.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const root = join(import.meta.dirname, '..');
let site, browser;
before(async () => {
  mkdirSync(join(root, 'dist/test-cdn'), { recursive: true });
  writeFileSync(join(root, 'dist/test-cdn/index.html'), `<!doctype html><html lang="en"><head>
  <link rel="stylesheet" href="../themes/default.css">
  <script type="module" src="../cdn/toggle-switch.js"></script>
  <script type="module" src="../cdn/tab-list.js"></script>
  <script type="module" src="../cdn/signin-block.js"></script>
</head><body>
  <toggle-switch label="Email me"></toggle-switch>
  <tab-list id="tabs"></tab-list>
  <signin-block></signin-block>
  <script type="module">document.querySelector('#tabs').tabs = [{ value: 'one', label: 'One' }, { value: 'two', label: 'Two' }];</script>
</body></html>`);
  site = await serve(join(root, 'dist'));
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  site?.close();
});

test('every cdn file imports only relative paths', () => {
  for (const file of readdirSync(join(root, 'dist/cdn'))) {
    const source = readFileSync(join(root, 'dist/cdn', file), 'utf8');
    for (const [, specifier] of source.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
      assert.match(specifier, /^\.\.?\//, `${file} imports "${specifier}"`);
    }
  }
});

test('script tags alone: the components load, work, and bring what they import', async () => {
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
  await page.goto(`${site.url}/test-cdn/`, { waitUntil: 'networkidle' });
  const defined = await page.evaluate(() => Promise.race([Promise.all(['toggle-switch', 'tab-list', 'signin-block'].map((name) => customElements.whenDefined(name))).then(() => true), new Promise((done) => setTimeout(() => done(false), 10000))]));
  assert.ok(defined, `every component defined (${problems.join('; ')})`);
  const toggle = page.getByRole('switch', { name: 'Email me' });
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), 'true');
  await page.locator('tab-list [role=tab][aria-selected=true]').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getAttribute('tab-list [role=tab][data-value=two]', 'aria-selected'), 'true', 'the primitives came from the site');
  assert.equal(await page.locator('signin-block toggle-switch').count(), 1, 'a block brings its own components');
  assert.deepEqual(problems, []);
  await page.close();
});
