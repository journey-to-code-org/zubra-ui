// The components' behaviour at its edges, on the site's live previews: each test is a defect a
// reviewer reproduced (keyboard focus lost, input silently changed, a dialog closing by accident).
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';

const root = join(import.meta.dirname, '..');
let site, browser;
before(async () => { site = await serve(join(root, 'dist')); browser = await chromium.launch(); });
after(async () => { await browser?.close(); site?.close(); });

async function open(name) {
  const page = await browser.newPage();
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
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
  const box = await tip.boundingBox();
  const from = await trigger.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + 2);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(400);
  assert.equal(await tip.isVisible(), true);
  await page.keyboard.press('Escape');
  assert.equal(await tip.isVisible(), false);
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
  assert.equal(await prop(element, 'index'), -1);
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
