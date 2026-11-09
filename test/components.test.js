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
