// The library site (dist/, from scripts/site.mjs) in a real browser: every page loads with no errors
// and no failed requests, every preview is a defined, rendered element, and the stack switch, dark
// mode, theme presets and a pasted shadcn theme all work and are remembered.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const root = join(import.meta.dirname, '..');
const { components } = JSON.parse(readFileSync(join(root, 'components/index.json'), 'utf8'));
let site, browser;
before(async () => { site = await serve(join(root, 'dist')); browser = await chromium.launch(); });
after(async () => { await browser?.close(); site?.close(); });

/** A page that records page errors, console errors and failed requests. */
// ZUBRA_UI_EMIT=element: the plain elements (`--emit element`) in place of the previews that have one.
const ELEMENTS = process.env.ZUBRA_UI_EMIT === 'element'
  ? new Set(readdirSync(join(root, 'dist/elements')).filter((file) => file.endsWith('.js')).map((file) => file.slice(0, -3)))
  : new Set();
// The pages that are tools rather than a component: no component preview of their own.
const TOOL_PAGES = ['/themes/', '/studio/', '/compose/'];
async function open(path, { context } = {}) {
  const page = await (context ?? browser).newPage();
  if (ELEMENTS.size) {
    await page.route(/\/preview\/([\w-]+)\.js$/, (route) => {
      const component = route.request().url().match(/\/preview\/([\w-]+)\.js$/)[1];
      return ELEMENTS.has(component) ? route.fulfill({ contentType: 'text/javascript', body: readFileSync(join(root, 'dist/elements', `${component}.js`)) }) : route.continue();
    });
  }
  const problems = [];
  page.on('pageerror', (error) => problems.push(`error: ${error.message}`));
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
  page.on('response', (response) => response.status() >= 400 && problems.push(`${response.status()}: ${response.url()}`));
  await page.goto(site.url + path, { waitUntil: 'networkidle' });
  return { page, problems };
}

// Many pages at once outgrow one browser (a page's networkidle times out): open them a few at a time.
async function eachPage(items, run, at = 10) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(at, queue.length) }, async () => {
    while (queue.length) await run(queue.shift());
  }));
}

test('every page loads cleanly and its previews render', async () => {
  const context = await browser.newContext();
  const pages = ['/', ...TOOL_PAGES, ...components.map(({ name }) => `/components/${name}/`)];
  const failures = [];
  await eachPage(pages, async (path) => {
    const { page, problems } = await open(path, { context });
    // With every page open at once, a module can still be loading at "network idle": wait (up to
    // ten seconds) for each preview to be defined before judging it.
    const previews = await page.evaluate(async () => {
      const stages = [...document.querySelectorAll('[data-preview]')];
      const names = stages.map((stage) => stage.dataset.preview);
      await Promise.race([Promise.all(names.map((name) => customElements.whenDefined(name))), new Promise((done) => setTimeout(done, 10000))]);
      await new Promise(requestAnimationFrame);
      return stages.map((stage) => {
        const name = stage.dataset.preview;
        const element = stage.querySelector(name);
        return { name, defined: !!customElements.get(name), rendered: !!element && (element.shadowRoot?.childElementCount ?? element.childElementCount) > 0 };
      });
    });
    if (!previews.length && !TOOL_PAGES.includes(path)) problems.push('no previews');
    for (const preview of previews) if (!preview.defined || !preview.rendered) problems.push(`preview ${preview.name}: ${JSON.stringify(preview)}`);
    if (problems.length) failures.push(`${path}\n  ${problems.join('\n  ')}`);
    await page.close();
  });
  await context.close();
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('API tables list the allowed values of a prop, not just "string"', async () => {
  // The types come from the compiler's manifest, which reads `declare const` in a lang="ts" script.
  const typeOf = (page, prop) => page.locator(`#prop-${prop} td:nth-child(2)`).innerText();
  const button = await open('/components/action-button/');
  assert.equal(await typeOf(button.page, 'variant'), '"primary" | "secondary" | "outline" | "ghost" | "destructive" | "link"');
  assert.equal(await typeOf(button.page, 'size'), '"sm" | "md" | "lg"');
  assert.equal(await typeOf(button.page, 'disabled'), 'boolean');
  const sheet = await open('/components/side-sheet/');
  assert.equal(await typeOf(sheet.page, 'side'), '"right" | "left" | "bottom"');
  await button.page.close();
  await sheet.page.close();
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
    for (const stage of document.querySelectorAll('[data-preview], .look, .variants')) visit(stage);
    return failures;
  });
}

test('preview text is readable in light and dark', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const failures = [];
  await eachPage([...components.map(({ name }) => name), 'themes'], async (name) => {
    const { page } = await open(name === 'themes' ? '/themes/' : `/components/${name}/`, { context });
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.click('#mode');
      for (const failure of await lowContrast(page)) failures.push(`${name} (${mode}): ${failure}`);
    }
    await page.close();
  });
  await context.close();
  assert.deepEqual(failures, [], failures.join('\n'));
});

test('on a phone nothing scrolls sideways, and the nav lists every component', async () => {
  const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
  const failures = [];
  await eachPage(['/', ...TOOL_PAGES, ...components.map(({ name }) => `/components/${name}/`)], async (path) => {
    const { page } = await open(path, { context });
    const { scroll, width, nav } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth, nav: document.querySelectorAll('.site-nav a[href*="components/"]').length }));
    if (scroll > width) failures.push(`${path}: ${scroll}px wide in ${width}px`);
    if (nav !== components.length) failures.push(`${path}: nav lists ${nav} of ${components.length}`);
    await page.close();
  });
  await context.close();
  assert.deepEqual(failures, [], failures.join('\n'));
});

// One exclusion: the donut chart's total sits in the ring's empty hole, but axe measures it against
// the ring's stroke colour (the circles have no fill). The contrast test above checks it for real.
test('axe finds no serious or critical problems on any page, light or dark', async () => {
  const axe = readFileSync(join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const failures = [];
  await eachPage(['/', ...TOOL_PAGES, ...components.map(({ name }) => `/components/${name}/`)], async (path) => {
    const { page } = await open(path, { context });
    await page.addScriptTag({ content: axe });
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.click('#mode');
      const violations = await page.evaluate(async () => (await window.axe.run({ exclude: [['donut-chart .middle']] }, { resultTypes: ['violations'] })).violations
        .filter((violation) => ['serious', 'critical'].includes(violation.impact))
        .map((violation) => `${violation.id}: ${violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(', ')}`));
      for (const violation of violations) failures.push(`${path} (${mode}) ${violation}`);
    }
    await page.close();
  });
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

test('themes: each section takes its theme, and the look picker themes the whole site', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  // (Reduced motion: colours are read after a change, not halfway through its transition.)
  const { page, problems } = await open('/themes/', { context });
  const looks = await page.$$eval('section.look[data-theme]', (sections) => sections.map((section) => ({
    theme: section.dataset.theme,
    primary: getComputedStyle(section.querySelector('action-button button')).backgroundColor,
    font: getComputedStyle(section.querySelector('content-card')).fontFamily,
    radius: getComputedStyle(section.querySelector('text-field input')).borderRadius,
  })));
  assert.deepEqual(looks.map((look) => look.theme), ['zinc', 'paper', 'terminal', 'candy', 'midnight']);
  assert.equal(new Set(looks.slice(0, 5).map((look) => look.primary)).size, 5, 'five different accents');
  assert.match(looks.find((look) => look.theme === 'paper').font, /Iowan|Palatino|Georgia/);
  assert.match(looks.find((look) => look.theme === 'terminal').font, /monospace/);
  assert.equal(looks.find((look) => look.theme === 'terminal').radius, '0px', 'square corners all the way down');

  // The look picker: the whole site, remembered on the next page.
  await page.click('#theme-open');
  await page.locator('#look').getByText('Terminal', { exact: true }).click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'terminal');
  // Terminal is dark first: the Dark button says so, and pressing it makes the page light.
  await page.keyboard.press('Escape');
  assert.equal(await page.getAttribute('#mode', 'aria-pressed'), 'true');
  const darkBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click('#mode');
  assert.equal(await page.getAttribute('#mode', 'aria-pressed'), 'false');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), darkBackground);
  const next = await context.newPage();
  await next.goto(`${site.url}/components/toggle-switch/`, { waitUntil: 'networkidle' });
  assert.equal(await next.evaluate(() => document.documentElement.dataset.theme), 'terminal');
  assert.deepEqual(problems, []);
  await context.close();
});

test('search filters the nav, "/" focuses it, and install commands follow the chosen package manager', async () => {
  const context = await browser.newContext();
  const { page, problems } = await open('/components/toggle-switch/', { context });
  await page.keyboard.press('/');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'nav-search');
  await page.keyboard.type('toast');
  const shown = await page.$$eval('.site-nav li:not([hidden]) a', (links) => links.map((link) => link.textContent));
  assert.deepEqual(shown, ['toast-region']);
  await page.fill('#nav-search', 'zzzz');
  assert.equal(await page.textContent('#nav-none'), 'No component matches.');
  await page.fill('#nav-search', 'but');
  assert.equal(await page.textContent('.site-nav li.nav-best'), 'action-button', 'a name that starts with it ranks first');
  await page.fill('#nav-search', 'stepper');
  await page.keyboard.press('Enter');
  await page.waitForURL(/quantity-stepper/);

  const install = page.locator('#install ~ .install pre').first();
  assert.match(await install.innerText(), /^npx shadcn@latest add /);
  await page.locator('#install ~ .install [data-pm-tab="npm"]').first().focus();
  await page.keyboard.press('ArrowRight');
  assert.match(await install.innerText(), /^pnpm dlx shadcn@latest add /, 'the arrow keys switch');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.pmTab), 'pnpm');
  assert.deepEqual(await page.locator('#install ~ .install').first().locator('[data-pm-tab]').evaluateAll((tabs) => tabs.map((tab) => tab.tabIndex)), [-1, 0, -1, -1], 'one Tab stop per row');
  const next = await context.newPage();
  await next.goto(`${site.url}/`, { waitUntil: 'networkidle' });
  assert.match(await next.locator('.steps pre').first().innerText(), /^pnpm dlx shadcn/, 'remembered across pages');
  assert.deepEqual(problems, []);
  await context.close();
});

test('theme studio: colours change the light and dark previews, contrast is checked, and the theme travels', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { page, problems } = await open('/studio/', { context });
  const button = (scheme) => page.locator(`#studio-${scheme} action-button button`).first().evaluate((el) => getComputedStyle(el).backgroundColor);
  // A new primary for light.
  await page.locator('#studio-colours [data-key=primary]').evaluate((input) => { input.value = '#0f766e'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(await button('light'), 'rgb(15, 118, 110)');
  assert.notEqual(await button('dark'), 'rgb(15, 118, 110)', 'dark keeps its own until changed');
  // Typed CSS colours are checked.
  await page.locator('#studio-colours [data-css=primary]').fill('not a colour');
  await page.locator('#studio-colours [data-css=primary]').dispatchEvent('change');
  assert.match(await page.textContent('#studio-status'), /isn't a CSS colour/);
  assert.equal(await page.locator('#studio-colours [data-css=primary]').getAttribute('aria-invalid'), 'true');
  // A light primary gets dark text on it, so it stays readable.
  await page.locator('#studio-colours [data-css=primary]').fill('#ffee00');
  await page.locator('#studio-colours [data-css=primary]').dispatchEvent('change');
  assert.match(await page.locator('#studio-contrast tbody tr', { hasText: 'Text on primary' }).locator('td').first().textContent(), /Passes/);
  assert.equal(await page.textContent('#studio-warning'), '');
  await page.locator('#studio-colours [data-css=primary]').blur();
  await page.locator('#studio-colours [data-key=primary]').evaluate((input) => { input.value = '#0f766e'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  // Dark made from light keeps the hue, lifted for a dark page.
  await page.click('#studio-derive');
  const dark = await button('dark');
  assert.notEqual(dark, 'rgb(15, 118, 110)');
  assert.match(await page.textContent('#studio-json'), /"dark": \{/);
  // Contrast: a row per pair, each judged.
  assert.equal(await page.locator('#studio-contrast tbody tr').count(), 8);
  assert.ok((await page.locator('#studio-contrast status-badge').count()) >= 14);
  // Name, corners and the CSS to copy.
  await page.getByLabel('Name').fill('Sea Glass');
  await page.getByLabel('Name').press('Tab');
  assert.match(await page.textContent('#studio-css'), /\[data-theme="sea-glass"\]/);
  assert.equal(await page.textContent('#studio-json-name'), 'themes/sets/sea-glass.json');
  // A link carries it to another page; "Use on this site" makes it the site's look.
  await page.click('#studio-share');
  const link = page.url();
  assert.match(link, /#theme=/);
  const other = await (await browser.newContext()).newPage();
  await other.goto(link, { waitUntil: 'networkidle' });
  await other.waitForFunction(() => document.querySelector('#studio-css')?.textContent.includes('sea-glass'));
  await other.context().close();
  await page.click('#studio-use');
  const next = await context.newPage();
  await next.goto(`${site.url}/components/action-button/`, { waitUntil: 'networkidle' });
  assert.equal(await next.evaluate(() => document.documentElement.dataset.theme), 'custom');
  assert.equal(await next.locator('[data-preview] action-button button').evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(15, 118, 110)');
  assert.deepEqual(problems, []);
  await context.close();
});

test('page composer: add, change, move and remove; the theme and mode apply; the exported page runs as it is', async () => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1500, height: 1000 } });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { page, problems } = await open('/compose/', { context });
  await page.waitForSelector('.composer[data-ready]');
  // Each change redraws the canvas (loading a component first if it's new): wait for that.
  const settled = () => page.waitForFunction(() => !document.querySelector('.composer').dataset.busy);
  const names = async () => { await settled(); return page.locator('#compose-canvas .composer-item').evaluateAll((items) => items.map((item) => item.querySelector('.composer-name').textContent)); };
  assert.deepEqual((await names()).slice(0, 3), ['nav-bar', 'hero-section', 'logo-cloud'], 'starts from the landing page');
  // Add after the selected item, then change it in the inspector.
  await page.locator('#compose-canvas [data-uid]').first().click({ position: { x: 5, y: 5 } });
  await page.getByRole('button', { name: 'Add stat-card' }).click();
  assert.equal((await names())[1], 'stat-card');
  await page.locator('#compose-inspector input[data-attribute=label]').fill('Loaves sold');
  await page.locator('#compose-inspector input[data-attribute=label]').press('Tab');
  await settled();
  assert.match(await page.locator('#compose-canvas stat-card').textContent(), /Loaves sold/);
  await page.locator('#compose-inspector [data-prop=change]').fill('8');
  await page.locator('#compose-inspector [data-prop=change]').press('Tab');
  await settled();
  assert.match(await page.locator('#compose-canvas stat-card').textContent(), /up 8%/);
  // Bad JSON keeps the last good value and says so.
  await page.locator('#compose-canvas [data-uid]').nth(0).focus();
  await page.keyboard.press('Enter');
  await page.locator('#compose-inspector [data-prop=links]').fill('[not json');
  await page.locator('#compose-inspector [data-prop=links]').press('Tab');
  assert.match(await page.textContent('#inspector-problem'), /Not valid JSON/);
  // Keyboard: Alt+Down moves the focused item; Delete removes it.
  const statCard = page.locator('#compose-canvas .composer-item', { has: page.locator('stat-card') });
  await statCard.focus();
  await page.keyboard.press('Alt+ArrowDown');
  assert.equal((await names())[2], 'stat-card');
  assert.match(await page.textContent('#compose-status'), /Moved stat-card down/);
  // Focus stays on the block, so moves chain.
  await page.keyboard.press('Alt+ArrowDown');
  assert.equal((await names())[3], 'stat-card');
  assert.ok(await page.evaluate(() => document.activeElement.matches('.composer-item') && Boolean(document.activeElement.querySelector('stat-card'))));
  await page.keyboard.press('Delete');
  assert.ok(!(await names()).includes('stat-card'));
  // Undo brings it back where it was.
  await page.keyboard.press('Control+z');
  assert.equal((await names())[3], 'stat-card');
  await page.keyboard.press('Control+z');
  assert.equal((await names())[2], 'stat-card');
  await statCard.focus();
  await page.keyboard.press('Delete');
  assert.ok(!(await names()).includes('stat-card'));
  // Theme and mode reach the canvas only.
  await page.locator('#compose-theme select').selectOption('terminal');
  await page.locator('#compose-mode').getByText('Dark', { exact: true }).click();
  await settled();
  const canvasFont = await page.locator('#compose-canvas').evaluate((el) => getComputedStyle(el).fontFamily);
  assert.match(canvasFont, /monospace/);
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).fontFamily), canvasFont, 'the site itself is untouched');
  // The exported page: script tags for every component used (and ones used inside others), and it runs.
  const html = await page.textContent('#compose-code');
  assert.match(html, /data-theme="terminal"/);
  assert.match(html, /\/cdn\/action-button\.js/, 'an action-button inside the hero is loaded too');
  assert.match(await page.textContent('#compose-install'), /r\/themes\/terminal\.json/);
  const exported = html.replaceAll('http://127.0.0.1:4174', site.url);
  mkdirSync(join(root, 'dist/test-compose'), { recursive: true });
  writeFileSync(join(root, 'dist/test-compose/index.html'), exported);
  const run = await context.newPage();
  const runProblems = [];
  run.on('pageerror', (error) => runProblems.push(error.message));
  run.on('console', (message) => message.type() === 'error' && runProblems.push(message.text()));
  await run.goto(`${site.url}/test-compose/`, { waitUntil: 'networkidle' });
  const names2 = await run.evaluate(() => [...document.querySelectorAll('main > *')].map((el) => el.localName));
  const undefinedOnes = await run.evaluate((list) => list.filter((name) => !customElements.get(name)), names2);
  assert.deepEqual(undefinedOnes, [], 'every component in the exported page is defined');
  assert.match(await run.locator('nav-bar').textContent(), /Recipes/, 'its properties were set');
  assert.deepEqual(runProblems, []);
  // A shared link brings the page back, with anything that could run removed from its HTML.
  await page.click('#compose-share');
  const shared = new URL(page.url());
  const evil = { theme: 'zinc', mode: 'light', items: [{ name: 'alert-banner', width: 'full', attrs: { heading: 'Hi' }, props: {}, html: '<img src=x onerror="window.pwned=1"><script>window.pwned=2</script><a href="javascript:window.pwned=3">x</a>Safe text' }] };
  const encoded = Buffer.from(JSON.stringify(evil)).toString('base64url');
  const other = await context.newPage();
  await other.goto(`${site.url}/compose/#page=${encoded}`, { waitUntil: 'networkidle' });
  await other.waitForSelector('.composer[data-ready]');
  assert.match(await other.locator('#compose-canvas alert-banner').textContent(), /Safe text/);
  assert.equal(await other.evaluate(() => window.pwned), undefined);
  assert.equal(await other.locator('#compose-canvas a').first().getAttribute('href'), null);
  assert.ok(shared.hash.startsWith('#page='));
  assert.deepEqual(problems, []);
  await context.close();
});
