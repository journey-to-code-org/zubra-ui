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

// Text in every preview against what's really behind it (backgrounds composited up through shadow
// roots), in light and dark. 3:1 is the floor: below it, text can't be read (WCAG large text).
async function lowContrast(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (css) => { canvas.clearRect(0, 0, 1, 1); canvas.fillStyle = '#000'; canvas.fillStyle = css; canvas.fillRect(0, 0, 1, 1); const [r, g, b, a] = canvas.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255]; };
    const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
    const parent = (node) => node.parentElement ?? node.parentNode?.host ?? null;
    const behind = (element) => {
      const layers = [];
      for (let node = element; node; node = parent(node)) {
        if (node.nodeType !== 1) continue;
        const color = rgba(getComputedStyle(node).backgroundColor);
        if (color[3] > 0) { layers.push(color); if (color[3] === 1) break; }
      }
      return layers.reverse().reduce((base, layer) => over(layer, base), [255, 255, 255, 1]);
    };
    const luminance = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const failures = [];
    const visit = (root) => {
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) visit(element.shadowRoot);
        const text = [...element.childNodes].filter((node) => node.nodeType === 3 && node.textContent.trim()).map((node) => node.textContent.trim()).join(' ');
        if (!text || !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
        const style = getComputedStyle(element);
        const background = behind(element);
        const value = ratio(over(rgba(style.color), background), background);
        if (value < 3) failures.push(`"${text.slice(0, 30)}" ${value.toFixed(2)}:1`);
      }
    };
    for (const stage of document.querySelectorAll('[data-preview]')) visit(stage);
    return failures;
  });
}

test('preview text is readable in light and dark', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const failures = [];
  await Promise.all(components.map(async ({ name }) => {
    const { page } = await open(`/components/${name}/`, { context });
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.click('#mode');
      for (const failure of await lowContrast(page)) failures.push(`${name} (${mode}): ${failure}`);
    }
    await page.close();
  }));
  await context.close();
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('on a phone nothing scrolls sideways, and the nav lists every component', async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
  const failures = [];
  await Promise.all(['/', ...components.map(({ name }) => `/components/${name}/`)].map(async (path) => {
    const { page } = await open(path, { context });
    const { scroll, width, nav } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, nav: document.querySelectorAll('.side a[href*="components/"]').length }));
    if (scroll > width) failures.push(`${path}: ${scroll}px wide in ${width}px`);
    if (nav !== components.length) failures.push(`${path}: nav lists ${nav} of ${components.length}`);
    await page.close();
  }));
  await context.close();
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('previews report their events', async () => {
  const { page, problems } = await open('/components/quantity-stepper/');
  await page.locator('quantity-stepper').getByRole('button', { name: /increase|more|\+/i }).first().click();
  await page.waitForFunction(() => document.querySelector('[data-events=quantity-stepper] output'));
  assert.match(await page.textContent('[data-events=quantity-stepper]'), /valuechange: 3/);
  assert.deepEqual(problems, []);
  await page.close();
});
