// The components' behaviour at its edges, on the site's live previews: each test is a defect a
// reviewer reproduced (keyboard focus lost, input silently changed, a dialog closing by accident).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const root = join(import.meta.dirname, '..');
let site, browser;
before(async () => { site = await serve(join(root, 'dist')); browser = await chromium.launch(); });
after(async () => { await browser?.close(); site?.close(); });

// ZUBRA_UI_EMIT=element runs the same tests on the plain custom elements written by
// `--emit element` (scripts/build.mjs writes dist/elements/): each preview module that has one is swapped for it.
const ELEMENTS = process.env.ZUBRA_UI_EMIT === 'element'
  ? new Set(readdirSync(join(root, 'dist/elements')).filter((file) => file.endsWith('.js')).map((file) => file.slice(0, -3)))
  : new Set();
async function open(name) {
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  if (ELEMENTS.size) {
    await page.route(/\/preview\/([\w-]+)\.js$/, (route) => {
      const component = route.request().url().match(/\/preview\/([\w-]+)\.js$/)[1];
      if (!ELEMENTS.has(component)) return route.continue();
      return route.fulfill({ contentType: 'text/javascript', body: readFileSync(join(root, 'dist/elements', `${component}.js`)) });
    });
  }
  await page.goto(`${site.url}/components/${name}/`, { waitUntil: 'networkidle' });
  return { page, problems, element: page.locator(`[data-preview="${name}"] ${name}`) };
}
/** The focused element, through shadow roots, as `tag.class` or `tag[aria-label]`. */
const focused = (page) => page.evaluate(() => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active ? `${active.localName}${active.getAttribute('aria-label') ? `[${active.getAttribute('aria-label')}]` : ''}${active.className && typeof active.className === 'string' ? `.${active.className.split(' ')[0]}` : ''}` : null;
});
const prop = (element, name) => element.evaluate((el, name) => el[name], name);

test('streak-grid: Tab reaches a day', async () => {
  const { page, problems } = await open('streak-grid');
  const reached = [];
  await page.locator('[data-preview="streak-grid"]').evaluate((stage) => { stage.tabIndex = -1; stage.focus(); });
  await page.keyboard.press('Tab');
  reached.push(await page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a?.dataset?.day ?? a?.localName; }));
  assert.match(reached[0], /^\d{4}-\d{2}-\d{2}$/);
  await page.keyboard.press('ArrowUp');
  assert.notEqual(await page.evaluate(() => { let a = document.activeElement; while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement; return a?.dataset?.day; }), reached[0]);
  assert.deepEqual(problems, []);
  await page.close();
});

test('quantity-stepper: focus stays on the button at the limit, and code-set values are clamped', async () => {
  const { page, element, problems } = await open('quantity-stepper');
  await element.locator('.more').focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('Enter');
  assert.equal(await prop(element, 'value'), 8);
  assert.match(await focused(page), /^button\[More/);
  await element.evaluate((el) => { el.value = 99; });
  assert.equal(await element.locator('output').textContent(), '8');
  await element.evaluate((el) => { el.value = 'abc'; });
  assert.equal(await element.locator('output').textContent(), '1');
  assert.deepEqual(problems, []);
  await page.close();
});

test('tag-input: focus stays in the field at the limit and after removing; a pasted list is several tags', async () => {
  const { page, element, problems } = await open('tag-input');
  const input = element.locator('input');
  for (const tag of ['css', 'html', 'testing', 'performance']) { await input.fill(tag); await input.press('Enter'); }
  assert.equal((await prop(element, 'value')).length, 6);
  await input.focus();
  await page.keyboard.type('extra'); // read-only at the limit: typing does nothing
  await input.press('Enter');
  assert.equal((await prop(element, 'value')).length, 6);
  assert.match(await focused(page), /^input/);
  await input.press('Backspace');
  assert.equal((await prop(element, 'value')).length, 5);
  await element.getByRole('button', { name: 'Remove css' }).press('Enter');
  assert.equal((await prop(element, 'value')).includes('css'), false);
  assert.match(await focused(page), /^input/);

  await element.evaluate((el) => { el.value = []; });
  await input.focus();
  await input.evaluate((field) => {
    const data = new DataTransfer();
    data.setData('text', 'Pies, cakes\ncookies');
    field.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  assert.deepEqual(await prop(element, 'value'), ['pies', 'cakes', 'cookies']);
  // Text left in the field becomes a tag when focus moves on.
  await input.fill('scones');
  await page.locator('h1').click();
  assert.deepEqual(await prop(element, 'value'), ['pies', 'cakes', 'cookies', 'scones']);
  assert.deepEqual(problems, []);
  await page.close();
});

test('message-composer: Escape in the emoji picker puts focus back on its button', async () => {
  const { page, element, problems } = await open('message-composer');
  await element.getByRole('button', { name: 'Insert emoji' }).click();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  assert.match(await focused(page), /^button\[Insert emoji/);
  assert.deepEqual(problems, []);
  await page.close();
});

test('tool-tip: the pointer can move from the trigger into the tip', async () => {
  const { page, element, problems } = await open('tool-tip');
  const trigger = element.getByRole('button', { name: 'Save draft' });
  await trigger.hover();
  const tip = element.locator('[role=tooltip]');
  await tip.waitFor({ state: 'visible' });
  await page.waitForTimeout(250); // until it has faded in, where it stays
  const box = await tip.boundingBox();
  const from = await trigger.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + 2);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(400);
  assert.equal(await tip.isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await tip.evaluate((el) => el.matches(':popover-open')), false, 'closed at once (it fades out as it goes)');
  await tip.waitFor({ state: 'hidden', timeout: 1000 });
  assert.deepEqual(problems, []);
  await page.close();
});

test('modal-dialog: a drag that ends on the backdrop keeps it open; a data-close button closes it', async () => {
  const { page, element, problems } = await open('modal-dialog');
  await page.getByRole('button', { name: 'Delete project…' }).click();
  const text = element.locator('p').first();
  const box = await text.boundingBox();
  await page.mouse.move(box.x + 5, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 5 });
  await page.mouse.up();
  assert.equal(await prop(element, 'open'), true);
  await page.mouse.click(5, 5);
  assert.equal(await prop(element, 'open'), false);
  await page.getByRole('button', { name: 'Delete project…' }).click();
  await element.getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await prop(element, 'open'), false);
  assert.deepEqual(problems, []);
  await page.close();
});

test('money-input: text that isn\'t an amount is kept with a message, not changed into another number', async () => {
  const { page, element, problems } = await open('money-input');
  const input = element.locator('input');
  for (const [typed, value, message] of [['12 dollars', null, true], ['1e5', null, true], ['9'.repeat(400), null, true], ['$1,234.5', 1234.5, false], ['-50', -50, false]]) {
    await input.fill(typed);
    assert.equal(await prop(element, 'value'), value, typed);
    assert.equal(Boolean((await element.locator('.error').textContent()).trim()), message, typed);
  }
  // -50 is below min 0: invalid, through the form.
  assert.equal(await element.evaluate((el) => el.internals?.validity?.valid ?? el.closest('form')?.checkValidity() ?? !el.matches(':invalid')), false);
  await input.fill('12 dollars');
  await page.locator('h1').click();
  assert.equal(await input.inputValue(), '12 dollars');
  assert.deepEqual(problems, []);
  await page.close();
});

test('date-range: dates in the wrong order say so, and extreme years don\'t break it', async () => {
  const { page, element, problems } = await open('date-range');
  await element.evaluate((el) => { el.value = { start: '2026-12-22', end: '2026-12-18' }; });
  assert.match(await element.locator('.error').textContent(), /Check-out must be after check-in/);
  await element.locator('.start').fill('9999-12-31');
  await element.locator('.start').dispatchEvent('change');
  assert.equal(await element.locator('.nights').textContent(), '—');
  await element.locator('.start').evaluate((input) => { input.value = '2026-03-01'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await element.locator('.end').evaluate((input) => { input.value = '2026-03-04'; input.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.equal(await element.locator('.nights').textContent(), '3 nights');
  assert.deepEqual(problems, []);
  await page.close();
});

test('kanban-column: a dragged card reports its id on drop', async () => {
  const { page, problems } = await open('kanban-column');
  await page.locator('#card-notes').dragTo(page.locator('#card-theme'));
  await page.waitForFunction(() => document.querySelector('[data-events=kanban-column] output'));
  assert.match(await page.textContent('[data-events=kanban-column]'), /carddrop: \{"id":"card-notes","index":\d\}/);
  assert.deepEqual(problems, []);
  await page.close();
});

// ---- L3: the gallery, masonry and layouts

/** Items' boxes; true when none overlap and each sits a gap below the one above it in its column. */
const packed = (page, selector) => page.$$eval(selector, (items) => {
  const boxes = items.map((item) => item.getBoundingClientRect()).map(({ left, top, bottom, width }) => ({ left: Math.round(left), top, bottom, width }));
  const overlap = boxes.some((a, i) => boxes.some((b, j) => i !== j && a.left === b.left && a.top < b.bottom - 1 && b.top < a.bottom - 1));
  const columns = [...new Set(boxes.map((box) => box.left))].length;
  const gaps = boxes.map((box) => {
    const above = boxes.filter((other) => other.left === box.left && other.bottom <= box.top + 1).sort((a, b) => b.bottom - a.bottom)[0];
    return above ? box.top - above.bottom : null;
  }).filter((gap) => gap !== null);
  return { overlap, columns, count: boxes.length, widestGap: Math.max(0, ...gaps), firstRowInOrder: boxes.slice(0, columns).every((box, i, row) => i === 0 || box.left > row[i - 1].left) };
});

test('image-gallery: the manifest\'s photos, packed in reading order, with sizes and resolved URLs', async () => {
  const { page, element, problems } = await open('image-gallery');
  await element.locator('li').nth(7).waitFor();
  const manifest = await (await page.request.get(`${site.url}/gallery/gallery.json`)).json();
  const images = await element.locator('.grid img').evaluateAll((list) => list.map((img) => ({ alt: img.alt, width: img.getAttribute('width'), height: img.getAttribute('height'), src: img.src, srcset: img.getAttribute('srcset') })));
  assert.deepEqual(images.map((img) => img.alt), manifest.items.map((item) => item.alt), 'DOM order is the manifest\'s order');
  for (const img of images) {
    assert.ok(img.width && img.height, `${img.alt}: width and height, so nothing jumps`);
    assert.match(img.src, /\/gallery\/[\w-]+\.jpg$/, 'relative to the manifest');
    for (const candidate of img.srcset.split(', ')) assert.match(candidate, /^http:\/\/127\.0\.0\.1:\d+\/gallery\/[\w-]+\.webp \d+w$/);
  }
  await page.waitForFunction(() => [...document.querySelectorAll('image-gallery .grid img')].every((img) => img.complete));
  const layout = await packed(page, 'image-gallery .grid > li');
  assert.equal(layout.overlap, false);
  assert.ok(layout.columns >= 2, `${layout.columns} columns`);
  assert.ok(layout.firstRowInOrder, 'the first items run left to right');
  assert.ok(layout.widestGap < 24, `items pack up to the one above (largest gap ${layout.widestGap}px)`);
  assert.deepEqual(problems, []);
  await page.close();
});

test('image-gallery: the lightbox opens on a photo, steps with the arrows, and closes back to it', async () => {
  const { page, element, problems } = await open('image-gallery');
  const thumb = element.locator('.thumb').nth(1);
  await thumb.focus();
  await page.keyboard.press('Enter');
  const count = element.locator('.lightbox .count');
  await count.waitFor();
  assert.equal(await count.textContent(), '2 of 8');
  assert.equal(await prop(element, 'index'), 1);
  assert.match(await element.locator('.lightbox picture source').first().getAttribute('type'), /image\/avif/);
  await page.keyboard.press('ArrowRight');
  assert.equal(await count.textContent(), '3 of 8');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await count.textContent(), '8 of 8', 'it wraps around');
  await page.keyboard.press('Escape');
  // The dialog's close event comes in a later task: wait for it, not a race.
  await element.evaluate((el) => new Promise((resolve) => { const check = () => (el.index === -1 ? resolve() : setTimeout(check, 10)); check(); }));
  assert.equal(await element.locator('.lightbox').evaluate((dialog) => dialog.open), false);
  assert.equal(await thumb.evaluate((button) => button === document.activeElement), true, 'focus is back on the photo it opened from');
  await element.evaluate((el) => { el.index = 4; });
  await element.getByRole('button', { name: 'Close' }).click();
  assert.equal(await prop(element, 'index'), -1);
  assert.deepEqual(problems, []);
  await page.close();
});

test('image-gallery: a manifest that won\'t load says so', async () => {
  const { page, element } = await open('image-gallery');
  await element.evaluate((el) => { el.src = '../../gallery/missing.json'; });
  await element.locator('.status').waitFor();
  assert.match(await element.locator('.status').textContent(), /Couldn't load the photos/);
  await page.close();
});

test('masonry-grid: items of different heights pack in reading order, and a new one joins in', async () => {
  const { page, element, problems } = await open('masonry-grid');
  let layout = await packed(page, 'masonry-grid article');
  assert.equal(layout.overlap, false);
  assert.ok(layout.columns >= 2 && layout.firstRowInOrder);
  assert.ok(layout.widestGap < 20, `largest gap ${layout.widestGap}px`);
  await element.locator('.grid').evaluate((grid) => {
    const note = document.createElement('article');
    note.innerHTML = '<h3>Added later</h3><p>One more line of text, then another, then another to make it tall.</p>';
    grid.append(note);
  });
  await page.waitForTimeout(100);
  layout = await packed(page, 'masonry-grid article');
  assert.equal(layout.count, 7);
  assert.equal(layout.overlap, false);
  assert.deepEqual(problems, []);
  await page.close();
});

test('sidebar-layout and auto-grid follow the space they have, with no media queries', async () => {
  for (const [width, beside, columns] of [[1280, true, 4], [360, false, 1]]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(`${site.url}/components/sidebar-layout/`, { waitUntil: 'networkidle' });
    const [side, main] = await page.$$eval('[data-preview] sidebar-layout > div > div', (parts) => parts.map((part) => part.getBoundingClientRect().toJSON()));
    assert.equal(side.right <= main.left, beside, `${width}px: sidebar ${beside ? 'beside' : 'above'} the content`);
    if (!beside) assert.ok(side.bottom <= main.top);
    await page.goto(`${site.url}/components/auto-grid/`, { waitUntil: 'networkidle' });
    const lefts = await page.$$eval('[data-preview] auto-grid .demo-box', (cells) => new Set(cells.map((cell) => Math.round(cell.getBoundingClientRect().left))).size);
    assert.equal(lefts, columns, `${width}px: ${columns} columns`);
    await page.close();
  }
});

test('image-gallery: a photo whose srcset has an unsafe URL doesn\'t get one (Zubra 5.1\'s check)', async () => {
  const { page, element } = await open('image-gallery');
  const messages = [];
  page.on('console', (message) => messages.push(message.text()));
  await element.evaluate((el) => {
    el.src = '';
    el.items = [{ src: '/a.jpg', alt: 'Safe', width: 4, height: 3, srcset: '/a-480.webp 480w, /a-960.webp 960w' }, { src: '/b.jpg', alt: 'Unsafe', width: 4, height: 3, srcset: '/b.webp 480w, javascript:alert(1) 960w' }];
  });
  await element.locator('.grid img').nth(1).waitFor({ state: 'attached' });
  const sets = await element.locator('.grid img').evaluateAll((list) => list.map((img) => img.getAttribute('srcset')));
  assert.deepEqual(sets, ['/a-480.webp 480w, /a-960.webp 960w', null]);
  assert.ok(messages.some((message) => message.includes('blocked an unsafe URL')));
  await page.close();
});

// ---- L4: blocks (components made of components)

/** Records an element's events into window.__events as [type, detail]. */
const record = (element, types) => element.evaluate((el, types) => {
  window.__events = [];
  for (const type of types) el.addEventListener(type, (event) => window.__events.push([type, event.detail]));
}, types);
const events = (page) => page.evaluate(() => window.__events);

test('signin-block: submits what was typed, shows the password on request, and announces an error', async () => {
  const { page, element, problems } = await open('signin-block');
  await record(element, ['signin']);
  await element.getByLabel('Email').fill('maya@example.com');
  const password = element.locator('input[name=password]');
  await password.fill('correct horse');
  assert.equal(await element.getByLabel('Password', { exact: true }).getAttribute('name'), 'password', 'the label is the field\'s alone');
  await element.getByRole('button', { name: 'Show password' }).click();
  assert.equal(await password.getAttribute('type'), 'text');
  await element.getByRole('button', { name: 'Hide password' }).click();
  assert.equal(await password.getAttribute('type'), 'password');
  await element.getByRole('switch', { name: 'Keep me signed in' }).click();
  await element.getByRole('button', { name: 'Sign in' }).click();
  assert.deepEqual(await events(page), [['signin', { email: 'maya@example.com', password: 'correct horse', remember: false }]]);
  assert.match(page.url(), /\/components\/signin-block\/$/, 'no action: the page stays');
  await element.evaluate((el) => { el.error = 'That password doesn\'t match.'; el.errorField = 'password'; });
  assert.equal(await element.getByRole('alert').textContent(), 'That password doesn\'t match.');
  assert.equal(await password.getAttribute('aria-invalid'), 'true');
  assert.equal(await element.getByLabel('Email').getAttribute('aria-invalid'), 'false', 'only the field that was wrong');
  await password.fill('another try');
  assert.equal(await password.getAttribute('aria-invalid'), 'false', 'editing it clears the mark');
  await element.evaluate((el) => { el.busy = true; });
  assert.deepEqual(await element.locator('input, .signin-submit').evaluateAll((controls) => controls.map((control) => control.matches(':disabled'))), [true, true, true], 'busy: nothing can be changed or sent');
  assert.equal(await element.locator('form').getAttribute('aria-busy'), 'true');
  assert.equal(await element.locator('toggle-switch').getAttribute('name'), 'remember', 'a posted form includes it');
  assert.deepEqual(problems, []);
  await page.close();
});

test('settings-block: edits flow into value, Save sends it, and delete asks first', async () => {
  const { page, element, problems } = await open('settings-block');
  await record(element, ['save', 'delete']);
  await element.getByLabel('Name').fill('Maya C.');
  await element.getByRole('switch', { name: /Weekly summary/ }).click();
  await element.getByRole('button', { name: 'Dark' }).click();
  const value = await prop(element, 'value');
  assert.deepEqual(value, { name: 'Maya C.', email: 'maya@example.com', notifications: { replies: true, digest: true }, theme: 'dark' });
  await element.getByRole('button', { name: 'Save changes' }).click();
  assert.equal(await element.getByRole('status').textContent(), 'Saved.');
  await element.evaluate((el) => { el.busy = true; });
  assert.equal(await element.getByRole('button', { name: 'Saving…' }).isDisabled(), true);
  await element.evaluate((el) => { el.busy = false; el.status = 'Couldn\'t save: you\'re offline.'; });
  assert.equal(await element.getByRole('status').textContent(), 'Couldn\'t save: you\'re offline.', 'the host says what happened');
  await element.getByRole('button', { name: 'Delete account…' }).click();
  const dialog = element.locator('modal-dialog');
  assert.equal(await prop(dialog, 'open'), true);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await prop(dialog, 'open'), false);
  await element.getByRole('button', { name: 'Delete account…' }).click();
  await dialog.getByRole('button', { name: 'Delete account', exact: true }).click();
  assert.deepEqual((await events(page)).map(([type]) => type), ['save', 'delete']);
  assert.deepEqual((await events(page))[0][1], value);
  assert.deepEqual(problems, []);
  await page.close();
});

test('pricing-block: yearly prices and savings, and choosing reports the plan and period', async () => {
  const { page, element, problems } = await open('pricing-block');
  await record(element, ['choose', 'periodchange']);
  const team = element.locator('article').nth(1);
  assert.equal(await team.locator('.pricing-amount').textContent(), '$12');
  assert.equal(await element.locator('article').first().locator('.pricing-amount').textContent(), '$0');
  await element.getByRole('button', { name: 'Yearly' }).click();
  assert.equal(await team.locator('.pricing-amount').textContent(), '$10', 'a month, billed yearly');
  assert.equal(await team.locator('.pricing-note').textContent(), '$120 billed yearly, save 17%');
  await team.getByRole('button', { name: 'Choose plan' }).click();
  assert.deepEqual(await events(page), [['periodchange', 'yearly'], ['choose', { plan: 'team', period: 'yearly' }]]);
  // A plan with an href is a link (a checkout page); a long name wraps instead of overflowing.
  await element.evaluate((el) => { el.plans = [{ id: 'x', name: 'Supercalifragilisticexpialidocious'.repeat(2), monthly: 5, href: '/checkout/x', features: ['A'.repeat(80)] }]; });
  assert.equal(await element.getByRole('link', { name: 'Choose plan' }).getAttribute('href'), '/checkout/x');
  const card = await element.locator('article').evaluate((article) => ({ scroll: article.scrollWidth, width: article.clientWidth }));
  assert.ok(card.scroll <= card.width, `nothing overflows the card (${card.scroll} > ${card.width})`);
  // Two blocks on a page: their ids don't collide.
  const ids = await page.evaluate(() => {
    const second = document.createElement('pricing-block');
    second.plans = [{ id: 'x', name: 'Other', monthly: 1 }];
    document.body.append(second);
    return second.updateComplete.then(() => [...document.querySelectorAll('pricing-block article')].map((article) => article.getAttribute('aria-labelledby')));
  });
  assert.equal(new Set(ids).size, ids.length, ids.join(', '));
  assert.deepEqual(problems, []);
  await page.close();
});

test('dashboard-shell: sections switch, the menu reports, and a narrow space folds the sidebar', async () => {
  const { page, element, problems } = await open('dashboard-shell');
  await record(element, ['currentchange', 'menuselect']);
  await element.getByRole('button', { name: 'Events' }).click();
  assert.equal(await element.locator('h1').textContent(), 'Events');
  assert.equal(await element.getByRole('button', { name: 'Events' }).getAttribute('aria-current'), 'page');
  await element.getByRole('button', { name: 'Maya Chen' }).click();
  await element.getByRole('menuitem', { name: 'Sign out' }).click();
  assert.deepEqual(await events(page), [['currentchange', 'events'], ['menuselect', 'signout']]);
  await page.setViewportSize({ width: 390, height: 800 });
  const nav = element.locator('nav');
  const menu = element.getByRole('button', { name: 'Menu' });
  assert.equal(await nav.isVisible(), false, 'folded away in a narrow space');
  await menu.click();
  assert.equal(await nav.isVisible(), true);
  await element.getByRole('button', { name: 'People' }).click();
  assert.equal(await nav.isVisible(), false, 'choosing a section folds it again');
  assert.equal(await element.locator('h1').textContent(), 'People');
  assert.equal(await menu.evaluate((button) => button === document.activeElement), true, 'focus goes back to Menu, not the page');
  await menu.click();
  await element.getByRole('button', { name: 'Events' }).focus();
  await page.keyboard.press('Escape');
  assert.equal(await nav.isVisible(), false, 'Escape folds it');
  assert.equal(await menu.getAttribute('aria-expanded'), 'false');
  assert.equal(await menu.evaluate((button) => button === document.activeElement), true);
  const box = await element.locator('.shell').evaluate((shell) => ({ scroll: shell.scrollWidth, width: shell.clientWidth }));
  assert.ok(box.scroll <= box.width, 'nothing overflows sideways');
  assert.deepEqual(problems, []);
  await page.close();
});

test('the plain elements are the ones under test (with ZUBRA_UI_EMIT=element)', { skip: !ELEMENTS.size }, async () => {
  for (const name of ELEMENTS) {
    const { page, element, problems } = await open(name === 'toggle-switch' ? 'signin-block' : name);
    // Wait for it: on a busy machine a module can still be loading at "network idle".
    const plain = await page.evaluate(async (name) => Object.getPrototypeOf(await customElements.whenDefined(name)) === HTMLElement, name);
    assert.ok(plain, `${name} is the plain element: a class straight on HTMLElement, not on @zubra/runtime's`);
    assert.deepEqual(problems, []);
    void element;
    await page.close();
  }
});

test('dashboard-shell: a long nav scrolls inside the shell, and no nav means no Menu button', async () => {
  const { page, element, problems } = await open('dashboard-shell');
  await element.evaluate((el) => { el.nav = Array.from({ length: 50 }, (_, i) => ({ id: `s${i}`, label: `Section ${i + 1}` })); });
  const sizes = await element.evaluate((el) => ({ shell: el.querySelector('.shell').offsetHeight, nav: el.querySelector('nav').scrollHeight }));
  assert.ok(sizes.shell < 600 && sizes.nav > sizes.shell, `the shell stays its height (${sizes.shell}px) and the nav scrolls`);
  await element.evaluate((el) => { el.nav = []; });
  await page.setViewportSize({ width: 390, height: 800 });
  assert.equal(await element.getByRole('button', { name: 'Menu' }).count(), 0);
  assert.deepEqual(problems, []);
  await page.close();
});

test('blocks keep their look when the page has its own .button, .actions and .brand rules', async () => {
  const { page, element } = await open('settings-block');
  await page.addStyleTag({ content: '.button, .destructive, .primary, .actions, .brand, .badge, .error { background: lime !important; }' });
  const colors = await element.evaluate((el) => [...el.querySelectorAll('button, [class]')].filter((node) => getComputedStyle(node).backgroundColor === 'rgb(0, 255, 0)').map((node) => node.className));
  assert.deepEqual(colors, [], 'no generic class names a host could match');
  await page.close();
});

// Motion: transitions take their timing from the theme's tokens, and every component that moves
// stops moving for a visitor who asked for less motion (checked in the source, then in a browser).
test('every component that animates uses the motion tokens and honours prefers-reduced-motion', async () => {
  const moving = [];
  for (const file of readdirSync(join(root, 'components')).filter((name) => name.endsWith('.zb'))) {
    const style = readFileSync(join(root, 'components', file), 'utf8').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
    if (!/transition|animation|@keyframes/.test(style)) continue;
    moving.push(file);
    assert.match(style, /@media \(prefers-reduced-motion: reduce\)/, `${file} stops under reduced motion`);
    for (const [rule] of style.matchAll(/transition:[^;}]*/g)) {
      assert.doesNotMatch(rule.replace(/var\([^()]*(\([^()]*\))?[^()]*\)/g, ''), /\d(m?s)\b/, `${file}: "${rule}" takes its duration from a token`);
    }
  }
  assert.ok(moving.length >= 8);
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(`${site.url}/components/toggle-switch/`, { waitUntil: 'networkidle' });
  const duration = await page.locator('[data-preview="toggle-switch"] toggle-switch .track').first().evaluate((track) => getComputedStyle(track).transitionDuration);
  assert.equal(duration, '0s');
  await page.close();
});

// ---- the everyday controls: native elements inside, so forms, keyboard and validation are the browser's

/** Puts `markup` in a new <form> on the page (the component's module is already loaded there) and returns its locator. */
async function inForm(page, markup) {
  await page.evaluate((markup) => {
    const form = Object.assign(document.createElement('form'), { id: 'test-form', innerHTML: markup });
    form.addEventListener('submit', (event) => { event.preventDefault(); window.submitted = Object.fromEntries(new FormData(form, event.submitter)); });
    document.body.append(form);
  }, markup);
  await page.waitForTimeout(50);
  return page.locator('#test-form');
}
const submit = (page) => page.evaluate(() => { window.submitted = null; document.querySelector('#test-form').requestSubmit(); return window.submitted; });

test('action-button: submits its form, and while loading it is busy and does nothing', async () => {
  const { page, problems } = await open('action-button');
  const form = await inForm(page, '<input name="q" value="x"><action-button type="submit" name="intent" value="save">Save</action-button>');
  await form.getByRole('button', { name: 'Save' }).click();
  assert.deepEqual(await page.evaluate(() => window.submitted), { q: 'x', intent: 'save' });
  await page.evaluate(() => { window.submitted = null; window.clicks = 0; const b = document.querySelector('#test-form action-button'); b.addEventListener('click', () => window.clicks++); b.loading = true; });
  const button = form.getByRole('button', { name: 'Save' });
  assert.equal(await button.getAttribute('aria-busy'), 'true');
  await button.click({ force: true });
  assert.deepEqual(await page.evaluate(() => [window.submitted, window.clicks]), [null, 0]);
  assert.deepEqual(problems, []);
  await page.close();
});

test('action-button: with href it is a link with the same text; without, a button again', async () => {
  const { page, problems } = await open('action-button');
  await page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div id="links"><action-button href="/docs/" variant="outline">Read the docs</action-button></div>'));
  const box = page.locator('#links');
  const link = box.getByRole('link', { name: 'Read the docs' });
  assert.equal(await link.getAttribute('href'), '/docs/');
  assert.equal(await box.getByRole('button').count(), 0);
  // Disabled: no href, so it goes nowhere, and it says it's disabled.
  await page.evaluate(() => { document.querySelector('#links action-button').disabled = true; });
  assert.equal(await box.locator('a').getAttribute('href'), null);
  assert.equal(await box.locator('a').getAttribute('aria-disabled'), 'true');
  // Without href it's a button, keeping its text.
  await page.evaluate(() => { const b = document.querySelector('#links action-button'); b.disabled = false; b.href = ''; });
  assert.equal(await box.getByRole('button', { name: 'Read the docs' }).count(), 1);
  assert.equal(await box.locator('a').count(), 0);
  assert.deepEqual(problems, []);
  await page.close();
});

test('text-field: label, two-way value, the browser\'s validation shown after leaving, and form data', async () => {
  const { page, element, problems } = await open('text-field');
  const input = element.getByLabel('Email');
  await input.focus();
  await page.keyboard.press('Tab');
  const error = element.locator('.field-error');
  assert.notEqual((await error.textContent()).trim(), '', 'an empty required field says so once left');
  assert.equal(await input.getAttribute('aria-invalid'), 'true');
  assert.match(await input.getAttribute('aria-describedby'), new RegExp(await error.getAttribute('id')));
  await input.fill('not-an-email');
  assert.match(await error.textContent(), /@|email/i, 'and keeps checking as you type');
  await input.fill('sam@example.com');
  assert.equal((await error.textContent()).trim(), '');
  assert.equal(await prop(element, 'value'), 'sam@example.com');
  await element.evaluate((el) => (el.value = 'from@code.dev'));
  assert.equal(await input.inputValue(), 'from@code.dev');
  const form = await inForm(page, '<text-field label="Name" name="name" value="Ada"></text-field>');
  assert.deepEqual(await submit(page), { name: 'Ada' });
  void form;
  assert.deepEqual(problems, []);
  await page.close();
});

test('check-box, radio-group and select-field: native keyboard, two-way values and form data', async () => {
  const { page, problems } = await open('radio-group');
  await inForm(page, `<check-box label="Agree" name="agree"></check-box>
    <radio-group label="Size" name="size"></radio-group>
    <select-field label="Colour" name="colour" placeholder="Pick one" required></select-field>`);
  await page.evaluate(() => {
    document.querySelector('#test-form radio-group').options = [{ value: 's', label: 'Small' }, { value: 'm', label: 'Medium' }];
    document.querySelector('#test-form radio-group').value = 's';
    document.querySelector('#test-form select-field').options = [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }];
  });
  await page.addScriptTag({ type: 'module', content: "import '/preview/check-box.js'; import '/preview/select-field.js';" });
  await page.waitForFunction(() => customElements.get('check-box') && customElements.get('select-field'));
  await page.evaluate(() => {
    document.querySelector('#test-form select-field').options = [{ value: 'red', label: 'Red' }, { value: 'blue', label: 'Blue' }];
    window.events = [];
    for (const type of ['checkedchange', 'valuechange']) document.querySelector('#test-form').addEventListener(type, (event) => window.events.push(`${type}:${event.detail}`));
  });
  const form = page.locator('#test-form');
  assert.equal(await page.evaluate(() => document.querySelector('#test-form').checkValidity()), false, 'a required select with only its placeholder is invalid');
  await form.getByLabel('Agree').check();
  await form.getByLabel('Small').focus();
  await page.keyboard.press('ArrowDown');
  await form.getByLabel('Colour').selectOption('blue');
  assert.deepEqual(await submit(page), { agree: 'on', size: 'm', colour: 'blue' });
  assert.deepEqual(await page.evaluate(() => window.events), ['checkedchange:true', 'valuechange:m', 'valuechange:blue']);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#test-form check-box, #test-form radio-group, #test-form select-field')].map((el) => el.checked ?? el.value)), [true, 'm', 'blue']);
  await page.evaluate(() => (document.querySelector('#test-form check-box').indeterminate = true));
  assert.equal(await form.getByLabel('Agree').evaluate((box) => box.indeterminate), true);
  assert.deepEqual(problems, []);
  await page.close();
});

test('alert-banner: the close button hides it and fires close, unless beforeclose is cancelled', async () => {
  const { page, element, problems } = await open('alert-banner');
  assert.equal(await element.getByRole('status').count(), 1, 'a warning is announced politely');
  await element.evaluate((el) => el.addEventListener('beforeclose', (event) => event.preventDefault(), { once: true }));
  await element.getByRole('button', { name: 'Dismiss' }).click();
  assert.equal(await element.getByRole('status').isVisible(), true, 'cancelled: still there');
  await element.evaluate((el) => el.addEventListener('close', () => (window.alertClosed = true)));
  await element.getByRole('button', { name: 'Dismiss' }).click();
  assert.equal(await element.getByRole('status').isVisible(), false);
  assert.equal(await page.evaluate(() => window.alertClosed), true);
  assert.deepEqual(problems, []);
  await page.close();
});

test('toast-region: a document event shows a toast above a modal, it closes itself, and the close button works', async () => {
  const { page, element, problems } = await open('toast-region');
  await element.evaluate((el) => (el.duration = 400));
  await page.evaluate(() => {
    const dialog = document.body.appendChild(document.createElement('dialog'));
    dialog.textContent = 'A modal';
    dialog.showModal();
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Saved', variant: 'success' } }));
    document.dispatchEvent(new CustomEvent('toast', { detail: { message: 'Kept', duration: 0 } }));
  });
  const toasts = element.locator('.toast-item:not([data-leaving])');
  assert.deepEqual(await toasts.allTextContents().then((texts) => texts.map((text) => text.replace('×', '').trim())), ['Saved', 'Kept']);
  assert.equal(await element.locator('section').evaluate((region) => region.matches(':popover-open')), true, 'in the top layer, above the modal');
  await page.waitForTimeout(700);
  assert.equal(await toasts.count(), 1, 'the timed one went');
  await page.keyboard.press('Escape');
  await element.getByRole('button', { name: 'Dismiss notification' }).click();
  assert.equal(await toasts.count(), 0);
  // The same message again replaces the one showing; Escape closes the newest.
  await page.evaluate(() => { for (const message of ['Saved', 'Saved', 'Copied']) document.dispatchEvent(new CustomEvent('toast', { detail: { message, duration: 0 } })); });
  assert.deepEqual((await toasts.allTextContents()).map((text) => text.replace('×', '').trim()), ['Saved', 'Copied']);
  await page.keyboard.press('Escape');
  assert.deepEqual((await toasts.allTextContents()).map((text) => text.replace('×', '').trim()), ['Saved']);
  assert.deepEqual(problems, []);
  await page.close();
});

test('user-avatar: initials when there is no picture, or the picture fails', async () => {
  const { page, element, problems } = await open('user-avatar');
  assert.equal(await element.getByRole('img', { name: 'Ada Lovelace' }).textContent(), 'AL');
  await element.evaluate((el) => (el.src = '/missing.png'));
  await page.waitForTimeout(200);
  assert.equal(await element.getByRole('img', { name: 'Ada Lovelace' }).textContent(), 'AL');
  assert.match(await element.textContent(), /online/, 'the status is said in words');
  void problems;
  await page.close();
});

test('content-card: one link, named by the heading, covering the card', async () => {
  const { page, element, problems } = await open('content-card');
  const links = element.getByRole('link');
  assert.equal(await links.count(), 1);
  assert.equal(await links.first().textContent(), 'Sourdough for beginners');
  const text = await element.locator('.card-text').boundingBox();
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href'), { x: text.x + 10, y: text.y + 5 }), '#sourdough', 'a click on the text opens it');
  assert.deepEqual(problems, []);
  await page.close();
});

test('backdrop-pattern: decorative only (hidden, never hit), and still under reduced motion', async () => {
  const { page, element, problems } = await open('backdrop-pattern');
  const layer = element.locator('.backdrop-layer');
  assert.equal(await layer.getAttribute('aria-hidden'), 'true');
  const box = await element.boundingBox();
  assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('backdrop-layer'), { x: box.x + 4, y: box.y + 4 }), false, 'clicks go through it');
  assert.notEqual(await layer.evaluate((el) => getComputedStyle(el).animationName), 'none', 'the aurora drifts');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await layer.evaluate((el) => getComputedStyle(el).animationDuration), '0s');
  assert.deepEqual(problems, []);
  await page.close();
});

test('switcher-layout: side by side when there is room, all stacked at once below the threshold', async () => {
  const { page, element, problems } = await open('switcher-layout');
  const tops = () => element.locator('.demo-box').evaluateAll((boxes) => boxes.map((box) => Math.round(box.getBoundingClientRect().top)));
  await element.evaluate((el) => (el.style.width = '40rem'));
  await page.waitForTimeout(100);
  assert.equal(new Set(await tops()).size, 1, 'one row');
  await element.evaluate((el) => (el.style.width = '20rem'));
  await page.waitForTimeout(100);
  assert.equal(new Set(await tops()).size, 3, 'three rows, not two and one');
  await element.evaluate((el) => { el.style.width = '40rem'; el.limit = 2; });
  await page.waitForTimeout(100);
  assert.equal(new Set(await tops()).size, 3, 'more children than the limit stack anyway');
  assert.deepEqual(problems, []);
  await page.close();
});

test('reel-layout: a focusable, labelled region; next and previous move one item and stop at the ends', async () => {
  const { page, element, problems } = await open('reel-layout');
  const reel = element.getByRole('region', { name: 'Upcoming events' });
  assert.equal(await reel.getAttribute('tabindex'), '0');
  await element.evaluate((el) => (el.style.width = '24rem'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const previous = element.getByRole('button', { name: 'Previous' });
  const next = element.getByRole('button', { name: 'Next' });
  await page.waitForTimeout(100);
  assert.equal(await previous.isDisabled(), true, 'at the start');
  await next.click();
  await page.waitForTimeout(150);
  assert.ok((await reel.evaluate((el) => el.scrollLeft)) > 100, 'scrolled by an item');
  assert.equal(await previous.isDisabled(), false);
  await reel.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
  await page.waitForTimeout(150);
  assert.equal(await next.isDisabled(), true, 'at the end');
  assert.deepEqual(problems, []);
  await page.close();
});

// ---- navigation

test('breadcrumb-trail and page-nav: the current place is marked; page-nav shows gaps and moves', async () => {
  let { page, element, problems } = await open('breadcrumb-trail');
  assert.equal(await element.locator('[aria-current=page]').textContent(), 'Sourdough');
  assert.equal(await element.getByRole('link').count(), 3, 'the current page is not a link');
  await page.close();
  ({ page, element, problems } = await open('page-nav'));
  assert.equal(await element.locator('[aria-current=page]').textContent(), '6');
  assert.deepEqual(await element.locator('li').evaluateAll((items) => items.map((item) => item.textContent.trim())), ['‹ Previous', '1', '…', '5', '6', '7', '…', '20', 'Next ›']);
  await element.evaluate((el) => el.addEventListener('pagechange', (event) => (window.paged = event.detail)));
  await element.getByRole('button', { name: 'Next ›' }).click();
  assert.equal(await page.evaluate(() => window.paged), 7);
  assert.equal(await element.locator('[aria-current=page]').textContent(), '7');
  assert.deepEqual(problems, []);
  await page.close();
});

test('side-sheet and popover-panel: open, close with Escape, and give focus back', async () => {
  let { page, element, problems } = await open('side-sheet');
  const opener = page.locator('[data-preview="side-sheet"] [data-open]');
  await opener.click();
  assert.equal(await element.locator('dialog').evaluate((dialog) => dialog.open && dialog.matches(':modal')), true);
  await page.keyboard.press('Escape');
  // (A dialog's close event comes a moment after Escape.)
  await element.evaluate((el) => new Promise((done) => (el.open ? el.addEventListener('openchange', done, { once: true }) : done())));
  assert.equal(await prop(element, 'open'), false);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.open), 'side-sheet', 'focus is back on the button that opened it');
  await page.close();
  ({ page, element, problems } = await open('popover-panel'));
  const trigger = element.getByRole('button', { name: 'Share' });
  await trigger.click();
  assert.equal(await element.locator('[popover]').evaluate((panel) => panel.matches(':popover-open')), true);
  // (The popover's toggle event comes a moment after it opens, and `open`, so aria-expanded, follow it.)
  await element.evaluate((el) => new Promise((done) => (el.open ? done() : el.addEventListener('openchange', done, { once: true }))));
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Escape');
  // (The popover's toggle event comes a moment after it closes.)
  await element.evaluate((el) => new Promise((done) => (el.open ? el.addEventListener('openchange', done, { once: true }) : done())));
  assert.equal(await prop(element, 'open'), false);
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Share', 'focus is back on the button');
  assert.deepEqual(problems, []);
  await page.close();
});

test('command-palette: Ctrl+K opens it; typing filters, arrows move, Enter runs the item', async () => {
  const { page, element, problems } = await open('command-palette');
  await element.evaluate((el) => el.addEventListener('select', (event) => (window.chose = event.detail)));
  await page.keyboard.press('Control+k');
  const box = element.getByRole('combobox');
  await box.waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('role')), 'combobox');
  await page.keyboard.type('in');
  assert.deepEqual(await element.locator('.palette-label').allTextContents(), ['Invite a teammate', 'Billing', 'Settings'], 'filtered');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const active = await box.getAttribute('aria-activedescendant');
  assert.equal((await element.locator(`[id="${active}"]`).textContent()).trim(), 'Settings');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.chose), 'settings');
  assert.match(page.url(), /#settings$/);
  assert.equal(await prop(element, 'open'), false);
  assert.deepEqual(problems, []);
  await page.close();
});

test('nav-bar: the current link is marked, and a narrow bar folds its links behind Menu', async () => {
  const { page, element, problems } = await open('nav-bar');
  assert.equal(await element.locator('a[aria-current=page]').textContent(), 'Recipes');
  await element.evaluate((el) => (el.style.width = '20rem'));
  const menu = element.getByRole('button', { name: 'Menu' });
  assert.equal(await menu.isVisible(), true);
  assert.equal(await element.getByRole('link', { name: 'Classes' }).isVisible(), false);
  await menu.click();
  assert.equal(await menu.getAttribute('aria-expanded'), 'true');
  assert.equal(await element.getByRole('link', { name: 'Classes' }).isVisible(), true);
  assert.deepEqual(problems, []);
  await page.close();
});

// ---- data

test('data-table: sorts by a column, filters every column, and selects rows', async () => {
  const { page, element, problems } = await open('data-table');
  const first = () => element.locator('tbody tr').first().locator('td').nth(1).textContent();
  await element.getByRole('button', { name: 'Amount' }).click();
  assert.equal(await first(), 'INV-1045', 'smallest amount first');
  await element.getByRole('button', { name: 'Amount' }).click();
  assert.equal(await first(), 'INV-1044');
  assert.equal(await element.locator('th[aria-sort=descending]').count(), 1);
  await element.getByRole('searchbox').fill('paid');
  assert.equal(await element.locator('tbody tr').count(), 2);
  await element.evaluate((el) => el.addEventListener('selectedchange', (event) => (window.picked = event.detail)));
  await element.getByLabel('Select all shown rows').check();
  assert.deepEqual((await page.evaluate(() => window.picked)).sort(), [1, 4]);
  await element.getByRole('searchbox').fill('');
  assert.equal(await element.getByLabel('Select all shown rows').evaluate((box) => box.indeterminate), true, 'some of the shown rows');
  assert.match(await element.getByRole('status').textContent(), /2 selected · 5 rows/);
  assert.deepEqual(problems, []);
  await page.close();
});

test('progress-bar, stat-card and bar-chart say their values in words', async () => {
  let { page, element } = await open('progress-bar');
  assert.equal(await element.getByRole('progressbar').getAttribute('aria-valuenow'), '64');
  await element.evaluate((el) => (el.indeterminate = true));
  assert.equal(await element.getByRole('progressbar').getAttribute('aria-valuenow'), null);
  await page.close();
  ({ page, element } = await open('stat-card'));
  assert.match(await element.textContent(), /up 12\.4%/);
  await element.evaluate((el) => { el.change = -3; el.good = 'down'; });
  assert.equal(await element.locator('.stat-good').count(), 1, 'falling is good when good is "down"');
  await page.close();
  ({ page, element } = await open('bar-chart'));
  assert.deepEqual(await element.locator('li').evaluateAll((items) => items.map((item) => item.textContent.replace(/\s+/g, ' ').trim())), ['Search 42%', 'Direct 23%', 'Social 18%', 'Email 11%', 'Referral 6%']);
  const widths = await element.locator('.bars-fill').evaluateAll((bars) => bars.map((bar) => bar.style.width));
  assert.equal(widths[0], '100%');
  await page.close();
});

// ---- inputs

test('range-slider, code-input and date-field: native keyboard, two-way values and events', async () => {
  let { page, element, problems } = await open('range-slider');
  await element.getByRole('slider').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await prop(element, 'value'), 450);
  assert.equal(await element.locator('output').textContent(), '450');
  await page.close();
  ({ page, element, problems } = await open('code-input'));
  await element.evaluate((el) => el.addEventListener('complete', (event) => (window.code = event.detail)));
  await element.getByLabel(/6-digit code/).focus();
  await page.keyboard.type('12a 34');
  assert.equal(await prop(element, 'value'), '1234', 'digits only');
  await page.keyboard.type('5678');
  assert.equal(await prop(element, 'value'), '123456', 'no more than six');
  assert.equal(await page.evaluate(() => window.code), '123456');
  assert.deepEqual(await element.locator('.code-box').allTextContents(), ['1', '2', '3', '4', '5', '6']);
  await page.close();
  ({ page, element, problems } = await open('date-field'));
  await element.getByLabel('Delivery date').fill('2026-12-24');
  assert.equal(await prop(element, 'value'), '2026-12-24');
  assert.deepEqual(problems, []);
  await page.close();
});

test('file-drop: lists chosen files, removes one (from the form too), and turns away ones too big', async () => {
  const { page, element, problems } = await open('file-drop');
  const input = element.locator('input[type=file]');
  await input.setInputFiles([
    { name: 'menu.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(2048) },
    { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.alloc(4096) },
  ]);
  assert.deepEqual(await element.locator('.drop-name').allTextContents(), ['menu.pdf', 'photo.png']);
  await element.getByRole('button', { name: 'Remove menu.pdf' }).click();
  assert.deepEqual(await input.evaluate((field) => [...field.files].map((file) => file.name)), ['photo.png']);
  await element.evaluate((el) => (el.maxSize = 0.001));
  await input.setInputFiles([{ name: 'huge.png', mimeType: 'image/png', buffer: Buffer.alloc(4096) }]);
  assert.match(await element.getByRole('alert').textContent(), /over 0\.001 MB/);
  assert.equal(await element.locator('.drop-name').count(), 0);
  assert.deepEqual(problems, []);
  await page.close();
});

// ---- page sections

test('faq-list and newsletter-signup: one answer open at a time; a valid address subscribes', async () => {
  let { page, element, problems } = await open('faq-list');
  const questions = element.locator('summary');
  await questions.nth(0).click();
  await questions.nth(1).click();
  assert.deepEqual(await element.locator('details').evaluateAll((all) => all.map((item) => item.open)), [false, true, false]);
  await page.close();
  ({ page, element, problems } = await open('newsletter-signup'));
  await element.evaluate((el) => el.addEventListener('subscribe', (event) => (window.signed = event.detail)));
  await element.getByLabel('Email address').fill('not an email');
  await element.getByRole('button', { name: 'Subscribe' }).click();
  assert.equal(await page.evaluate(() => window.signed), undefined);
  await element.getByLabel('Email address').fill('sam@example.com');
  await element.getByRole('button', { name: 'Subscribe' }).click();
  assert.equal(await page.evaluate(() => window.signed), 'sam@example.com');
  assert.match(await element.getByRole('status').textContent(), /Thanks/);
  assert.deepEqual(problems, []);
  await page.close();
});

// ---- found by Tailgate (a farm-to-door app built on these components) --------------------------

test('step-indicator: readonly shows where something is with no buttons, and past the end is all done', async () => {
  const { page, element, problems } = await open('step-indicator');
  await element.evaluate((el) => { el.steps = ['Placed', 'Driver assigned', 'On the way', 'Delivered']; el.current = 2; el.readonly = true; });
  assert.equal(await element.getByRole('button').count(), 0, 'nothing to press: it only says where things are');
  assert.equal((await element.locator('li[aria-current="step"]').textContent()).trim(), 'On the way');
  assert.match(await element.locator('li').nth(0).textContent(), /Placed \(done\)/, 'done steps say so in words');
  await element.evaluate((el) => { el.current = 4; });
  assert.equal(await element.locator('li.done').count(), 4, 'past the last step, every step is done');
  assert.equal(await element.locator('[aria-current="step"]').count(), 0);
  // Narrow: read-only keeps its labels (they're the point); buttons fold to numbers.
  await element.evaluate((el) => { el.current = 2; });
  await page.setViewportSize({ width: 390, height: 800 });
  assert.ok(await element.locator('li').nth(2).locator('.label').isVisible(), 'read-only labels stay');
  // Not read-only: the same steps, as buttons back to the finished ones.
  await element.evaluate((el) => { el.readonly = false; });
  assert.equal(await element.getByRole('button').count(), 4);
  assert.equal(await element.locator('button .label').first().isVisible(), false, 'narrow buttons are numbers');
  assert.deepEqual(problems, []);
  await page.close();
});

test('step-indicator: a page that lays its navs out as flex rows doesn\'t change it', async () => {
  const { page, element, problems } = await open('step-indicator');
  // As wide as a page's order card, where Tailgate saw it shrink.
  await element.evaluate((el) => { el.style.cssText = 'display: block; width: 40rem'; el.steps = ['A', 'B', 'C']; el.current = 1; el.readonly = true; });
  const width = () => element.evaluate((el) => Math.round(el.querySelector('ol').getBoundingClientRect().width));
  const before = await width();
  await page.addStyleTag({ content: 'nav { display: flex; gap: 2rem; }' });
  assert.equal(await width(), before);
  assert.deepEqual(problems, []);
  await page.close();
});

test('color-swatches: each colour is announced by its name, not its hex value', async () => {
  const { page, element, problems } = await open('color-swatches');
  assert.ok(await element.getByRole('radio', { name: 'Green' }).count(), 'the default colours have names');
  await element.evaluate((el) => { el.colors = ['#9b2d20', '#1f5f8b']; el.names = ['Barn red', 'Creek blue']; el.value = '#9b2d20'; });
  await element.getByRole('radio', { name: 'Barn red' }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await prop(element, 'value'), '#1f5f8b');
  assert.equal(await element.getByRole('radio', { name: 'Creek blue' }).getAttribute('aria-checked'), 'true');
  // A colour with no name is announced by its value, as before.
  await element.evaluate((el) => { el.names = []; });
  assert.ok(await element.getByRole('radio', { name: '#9b2d20' }).count());
  assert.deepEqual(problems, []);
  await page.close();
});

test('user-avatar: the server writes the initials, so they show before JavaScript', async () => {
  const { render } = await import('@zubra/compiler');
  const { html } = await render(join(root, 'components/user-avatar.zb'), { props: { name: '  Dana   Whitlock ' } });
  assert.match(html, />DW<\/span>/);
  // Any whitespace between the names (a pasted tab or line break), not only spaces.
  assert.match((await render(join(root, 'components/user-avatar.zb'), { props: { name: 'Dana\tWhitlock' } })).html, />DW<\/span>/);
  assert.match((await render(join(root, 'components/user-avatar.zb'), { props: { name: 'Dana\nWhitlock' } })).html, />DW<\/span>/);
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.setContent(html);
  assert.equal(await page.getByRole('img', { name: 'Dana Whitlock' }).textContent(), 'DW');
  await page.close();
});

test('dashboard-shell: a long name shortens in the user menu instead of pushing it out of the shell', async () => {
  const { page, element, problems } = await open('dashboard-shell');
  await element.evaluate((el) => { el.user = 'Dana Whitlock-Montgomery of Bittinger Road'; });
  await page.setViewportSize({ width: 390, height: 800 });
  const sizes = await element.evaluate((el) => {
    const shell = el.querySelector('.shell').getBoundingClientRect();
    const trigger = el.querySelector('header dropdown-menu .trigger').getBoundingClientRect();
    return { shellRight: shell.right, triggerRight: trigger.right };
  });
  assert.ok(sizes.triggerRight <= sizes.shellRight + 0.5, JSON.stringify(sizes));
  assert.deepEqual(problems, []);
  await page.close();
});

test('quantity-stepper: editable takes a typed number, clamped to its limits', async () => {
  const { page, element, problems } = await open('quantity-stepper');
  await element.evaluate((el) => { el.editable = true; el.max = 100; el.value = 1; });
  const field = element.getByRole('spinbutton');
  await field.fill('40');
  await field.press('Tab');
  assert.equal(await prop(element, 'value'), 40);
  await field.fill('900');
  await field.press('Enter');
  assert.equal(await prop(element, 'value'), 100, 'clamped to max');
  assert.equal(await field.inputValue(), '100');
  await element.evaluate((el) => { el.min = 5; });
  await field.fill('-3');
  await field.press('Tab');
  assert.equal(await prop(element, 'value'), 5, 'clamped to min');
  assert.equal(await field.inputValue(), '5');
  await field.fill('100');
  await field.press('Tab');
  await field.fill('');
  await field.press('Tab');
  assert.equal(await prop(element, 'value'), 100, 'nothing typed keeps the value');
  await element.locator('.less').click();
  assert.equal(await field.inputValue(), '99', 'the buttons still step it');
  assert.deepEqual(problems, []);
  await page.close();
});
