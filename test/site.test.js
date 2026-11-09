// The library site (dist/, from scripts/site.mjs) in a real browser: every page loads with no errors
// and no failed requests, every preview is a defined, rendered element, and the stack switch, dark
// mode, theme presets and a pasted shadcn theme all work and are remembered.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const root = join(import.meta.dirname, '..');
const { components } = JSON.parse(readFileSync(join(root, 'components/index.json'), 'utf8'));
let site, browser;
before(async () => { site = await serve(join(root, 'dist')); browser = await chromium.launch(); });
after(async () => { await browser?.close(); site?.close(); });

/** A page that records page errors, console errors and failed requests. */
async function open(path, { context } = {}) {
  const page = await (context ?? browser).newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(`error: ${error.message}`));
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
  page.on('response', (response) => response.status() >= 400 && problems.push(`${response.status()}: ${response.url()}`));
  await page.goto(site.url + path, { waitUntil: 'networkidle' });
  return { page, problems };
}

test('every page loads cleanly and its previews render', async () => {
  const context = await browser.newContext();
  const pages = ['/', ...components.map(({ name }) => `/components/${name}/`)];
  const failures = [];
  await Promise.all(pages.map(async (path) => {
    const { page, problems } = await open(path, { context });
    const previews = await page.$$eval('[data-preview]', (stages) => stages.map((stage) => {
      const name = stage.dataset.preview;
      const element = stage.querySelector(name);
      return { name, defined: !!customElements.get(name), rendered: !!element && (element.shadowRoot?.childElementCount ?? element.childElementCount) > 0 };
    }));
    if (!previews.length) problems.push('no previews');
    for (const preview of previews) if (!preview.defined || !preview.rendered) problems.push(`preview ${preview.name}: ${JSON.stringify(preview)}`);
    if (problems.length) failures.push(`${path}\n  ${problems.join('\n  ')}`);
    await page.close();
  }));
  await context.close();
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('the stack switch shows one stack everywhere and is remembered', async () => {
  const context = await browser.newContext();
  const { page, problems } = await open('/components/star-rating/', { context });
  const visible = () => page.$$eval('.stack-only', (blocks) => blocks.filter((block) => block.checkVisibility()).map((block) => block.dataset.stack));
  assert.deepEqual([...new Set(await visible())], ['html']);
  await page.locator('#stack').getByText('React', { exact: true }).click();
  assert.deepEqual([...new Set(await visible())], ['react']);
  assert.match(await page.locator('.stack-only[data-stack=react] pre').first().innerText(), /onvaluechange=\{/);

  const next = await context.newPage();
  await next.goto(`${site.url}/components/tab-list/`, { waitUntil: 'networkidle' });
  assert.equal(await next.evaluate(() => document.documentElement.dataset.stack), 'react');
  assert.deepEqual(problems, []);
  await context.close();
});

test('dark mode, presets and a pasted theme change the components', async () => {
  const context = await browser.newContext();
  const { page, problems } = await open('/components/toggle-switch/', { context });
  const primary = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  const light = await background();
  await page.click('#mode');
  assert.equal(await page.getAttribute('#mode', 'aria-pressed'), 'true');
  assert.notEqual(await background(), light);
  await page.click('#mode');

  const zinc = await primary();
  await page.click('#theme-open');
  await page.locator('#preset').getByText('Rose', { exact: true }).click();
  const rose = await primary();
  assert.notEqual(rose, zinc);

  // A pasted theme keeps only its variables: the rule that would hide the page is dropped.
  await page.fill('#paste', ':root { --primary: rgb(1, 2, 3); }\nbody { display: none }\n.dark { --primary: rgb(4, 5, 6); }');
  await page.click('#theme-apply');
  assert.equal(await primary(), 'rgb(1, 2, 3)');
  assert.match(await page.textContent('#paste-status'), /Applied 1 variables/);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).display), 'block');

  // Remembered on the next page, before paint.
  const next = await context.newPage();
  await next.goto(`${site.url}/`, { waitUntil: 'networkidle' });
  assert.equal(await next.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()), 'rgb(1, 2, 3)');

  await page.click('#theme-reset');
  assert.equal(await primary(), zinc);
  assert.deepEqual(problems, []);
  await context.close();
});

test('previews report their events', async () => {
  const { page, problems } = await open('/components/quantity-stepper/');
  await page.locator('quantity-stepper').getByRole('button', { name: /increase|more|\+/i }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-events=quantity-stepper] output'));
  assert.match(await page.textContent('[data-events=quantity-stepper]'), /valuechange: 3/);
  assert.deepEqual(problems, []);
  await page.close();
});
