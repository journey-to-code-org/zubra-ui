// Motion: what moves, moves the way it says, and stops for visitors who asked for less. On the
// site's live previews, like components.test.js; ZUBRA_UI_EMIT=element runs it on the plain elements.
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

const ELEMENTS = process.env.ZUBRA_UI_EMIT === 'element'
  ? new Set(readdirSync(join(root, 'dist/elements')).filter((file) => file.endsWith('.js')).map((file) => file.slice(0, -3)))
  : new Set();
async function open(name, options = {}) {
  const page = await browser.newPage(options);
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
const reduce = { reducedMotion: 'reduce' };

// ---- `animate` (Zubra 5.5): content that leaves, and lists that glide

test('toast-region: a dismissed toast slides out from where it was; in a top corner the rest glide up', async () => {
  const { page, element, problems } = await open('toast-region');
  const add = () => page.evaluate(() => { for (const message of ['One', 'Two', 'Three']) document.dispatchEvent(new CustomEvent('toast', { detail: { message, duration: 0 } })); });
  const top = (name) => element.locator('.toast-item', { hasText: name }).evaluate((el) => Math.round(el.getBoundingClientRect().top));
  const dismiss = (name) => element.locator('.toast-item', { hasText: name }).getByRole('button', { name: 'Dismiss notification' }).click();
  const live = element.locator('.toast-item:not([data-leaving])');

  // Bottom right (the default): the region shrinks from the top, so nothing else moves on screen.
  await add();
  await page.waitForTimeout(300);
  const [one, two] = [await top('One'), await top('Two')];
  await dismiss('One');
  const leaving = element.locator('.toast-item[data-leaving]');
  assert.equal(await leaving.count(), 1, 'the dismissed toast is still there, leaving');
  assert.deepEqual(await leaving.evaluate((el) => [el.textContent.includes('One'), el.inert, getComputedStyle(el).position]), [true, true, 'absolute']);
  const exit = await leaving.evaluate((el) => el.getAnimations().map((animation) => animation.transitionProperty ?? animation.animationName).sort());
  assert.deepEqual(exit, ['opacity', 'translate'], 'it transitions out, rather than playing its entrance again');
  assert.equal(Math.round(await leaving.evaluate((el) => el.getBoundingClientRect().top)), one, 'it leaves from where it was, not on top of the next one');
  assert.equal(await top('Two'), two, 'the one below stays put');
  assert.equal(await live.count(), 2);
  await page.waitForFunction(() => !document.querySelector('toast-region .toast-item[data-leaving]'), null, { timeout: 3000 });
  await element.evaluate((el) => el.querySelectorAll('.toast-item button').forEach((button) => button.click()));
  await page.waitForFunction(() => !document.querySelector('[data-preview="toast-region"] toast-region .toast-item'), null, { timeout: 3000 });

  // Top end: the region grows down, so the toasts below a dismissed one glide up into its place.
  await element.evaluate((el) => (el.position = 'top-end'));
  await add();
  await page.waitForTimeout(300);
  const three = await top('Three');
  await dismiss('One');
  const glides = await element.locator('.toast-item', { hasText: 'Three' }).evaluate((el) => el.getAnimations().filter((animation) => !(animation instanceof CSSAnimation) && !(animation instanceof CSSTransition)).length);
  assert.equal(glides, 1, 'Three glides up');
  await page.waitForTimeout(700);
  assert.ok(await top('Three') < three, 'and ends higher');
  assert.deepEqual(problems, []);
  await page.close();
});

test('toast-region: under reduced motion, a dismissed toast goes at once', async () => {
  const { page, element, problems } = await open('toast-region', reduce);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('toast', { detail: { message: 'One', duration: 0 } })));
  await element.getByRole('button', { name: 'Dismiss notification' }).click();
  assert.equal(await element.locator('.toast-item').count(), 0);
  assert.deepEqual(problems, []);
  await page.close();
});

test('word-rotate: words change in turn, the old one leaving, and screen readers get the list', async () => {
  const { page, element, problems } = await open('word-rotate');
  assert.equal(await element.locator('.rotate-label').textContent(), 'sourdough, focaccia, brioche, rye');
  assert.equal(await element.locator('.rotate-stage').getAttribute('aria-hidden'), 'true');
  await page.waitForFunction(() => document.querySelector('word-rotate .rotate-word[data-leaving]'), null, { timeout: 4000 });
  assert.equal(await element.locator('.rotate-word:not([data-leaving])').textContent(), 'focaccia');
  assert.equal(await element.locator('.rotate-word[data-leaving]').textContent(), 'sourdough');
  await page.waitForFunction(() => document.querySelectorAll('word-rotate .rotate-word').length === 1, null, { timeout: 3000 });
  assert.deepEqual(problems, []);
  await page.close();
});

test('word-rotate: under reduced motion, the first word stays', async () => {
  const { page, element, problems } = await open('word-rotate', reduce);
  await page.waitForTimeout(2600);
  assert.deepEqual(await element.locator('.rotate-word').allTextContents(), ['sourdough']);
  assert.deepEqual(problems, []);
  await page.close();
});

// ---- opening and closing: the platform's own transitions, in and out

test('modal-dialog: it fades and scales in, and out again before it leaves the top layer', async () => {
  const { page, element, problems } = await open('modal-dialog');
  await element.evaluate((el) => (el.open = true));
  const dialog = element.locator('dialog');
  const opening = await dialog.evaluate((el) => el.getAnimations().map((animation) => animation.transitionProperty).sort());
  assert.ok(opening.includes('opacity') && opening.includes('scale'), `transitions in: ${opening}`);
  await page.waitForTimeout(400);
  await element.evaluate((el) => (el.open = false));
  const closing = await dialog.evaluate((el) => [el.open, el.getAnimations().map((animation) => animation.transitionProperty).sort()]);
  assert.equal(closing[0], false);
  assert.ok(closing[1].includes('opacity') && closing[1].includes('overlay'), `transitions out, staying in the top layer meanwhile: ${closing[1]}`);
  assert.deepEqual(problems, []);
  await page.close();
});

test('the overlays transition in and out, and not at all under reduced motion', async () => {
  for (const [name, selector, show] of [
    ['side-sheet', 'dialog', (el) => (el.open = true)],
    ['popover-panel', '[popover]', (el) => (el.open = true)],
    ['dropdown-menu', '[popover]', (el) => el.querySelector('[popover]').showPopover()],
  ]) {
    for (const reduced of [false, true]) {
      const { page, element, problems } = await open(name, reduced ? reduce : {});
      await element.evaluate(show);
      const running = await element.locator(selector).evaluate((el) => el.getAnimations().filter((animation) => animation.playState === 'running').length);
      if (reduced) assert.equal(running, 0, `${name} doesn't move under reduced motion`);
      else assert.ok(running > 0, `${name} transitions in`);
      assert.deepEqual(problems, []);
      await page.close();
    }
  }
});

test('accordion-panel: the panel grows open, where the browser has ::details-content', async () => {
  const { page, element, problems } = await open('accordion-panel');
  const supported = await page.evaluate(() => CSS.supports('selector(::details-content)'));
  const details = element.locator('details');
  const height = () => details.evaluate((el) => el.getBoundingClientRect().height);
  const shut = await height();
  if (await element.evaluate((el) => el.open)) await element.evaluate((el) => (el.open = false));
  await page.waitForTimeout(400);
  const closed = await height();
  await element.evaluate((el) => (el.open = true));
  await page.waitForTimeout(60);
  const opening = await height();
  await page.waitForTimeout(400);
  const opened = await height();
  assert.ok(opened > closed && shut > 0);
  if (supported) assert.ok(opening > closed && opening < opened, `grows: ${closed} → ${opening} → ${opened}`);
  assert.deepEqual(problems, []);
  await page.close();
});

// ---- the motion components

test('reveal-on-scroll: hidden until it scrolls into view, then each child animates in turn', async () => {
  const { page, problems } = await open('reveal-on-scroll');
  await page.setContent(''); // a fresh page with the component below the fold
  await page.goto(`${site.url}/components/reveal-on-scroll/`, { waitUntil: 'networkidle' });
  const added = await page.evaluate(async () => {
    const spacer = document.body.appendChild(Object.assign(document.createElement('div'), { style: 'height: 3000px' }));
    const reveal = document.body.appendChild(document.createElement('reveal-on-scroll'));
    reveal.stagger = 100;
    reveal.innerHTML = '<p>One</p><p>Two</p><p>Three</p>';
    await new Promise((resolve) => setTimeout(resolve, 100));
    const waiting = getComputedStyle(reveal.querySelector('.reveal-frame')).opacity;
    reveal.scrollIntoView();
    await new Promise((resolve) => setTimeout(resolve, 150));
    const delays = [...reveal.querySelectorAll('.reveal-content > p')].map((p) => p.getAnimations()[0]?.effect.getTiming().delay);
    spacer.remove();
    return { waiting, delays };
  });
  assert.equal(added.waiting, '0', 'hidden while out of view');
  assert.deepEqual(added.delays, [0, 100, 200]);
  assert.deepEqual(problems, []);
  await page.close();
});

test('reveal-on-scroll: there at once under reduced motion', async () => {
  const { page, element, problems } = await open('reveal-on-scroll', reduce);
  assert.equal(await element.locator('.reveal-frame').evaluate((el) => getComputedStyle(el).opacity), '1');
  assert.equal(await element.evaluate((el) => el.getAnimations({ subtree: true }).length), 0);
  assert.deepEqual(problems, []);
  await page.close();
});

test('number-ticker: counts up to its value, says only the value, and counts on when it changes', async () => {
  const { page, element, problems } = await open('number-ticker');
  assert.equal(await element.locator('.ticker-label').textContent(), '12,480 loaves');
  await page.waitForFunction(() => document.querySelector('[data-preview="number-ticker"] number-ticker .ticker-number').textContent === '12,480 loaves', null, { timeout: 4000 });
  await element.evaluate((el) => { el.duration = 400; el.value = 12500; });
  await page.waitForTimeout(100);
  const midway = Number((await element.locator('.ticker-number').textContent()).replace(/\D/g, ''));
  assert.ok(midway > 12480 && midway <= 12500, `counting on from where it was: ${midway}`);
  await page.waitForFunction(() => document.querySelector('[data-preview="number-ticker"] number-ticker .ticker-number').textContent === '12,500 loaves', null, { timeout: 3000 });
  assert.deepEqual(problems, []);
  await page.close();
});

test('number-ticker and typing-text: the final value and text at once under reduced motion', async () => {
  for (const [name, selector, expected] of [['number-ticker', '.ticker-number', '12,480 loaves'], ['typing-text', '.typing-shown', 'Bake bread you are proud of.']]) {
    const { page, element, problems } = await open(name, reduce);
    assert.equal(await element.locator(selector).textContent(), expected);
    assert.deepEqual(problems, []);
    await page.close();
  }
});

test('typing-text: types a letter at a time, with the whole text for screen readers from the start', async () => {
  const { page, element, problems } = await open('typing-text');
  assert.equal(await element.locator('.typing-label').textContent(), 'Bake bread you are proud of.');
  const early = await element.locator('.typing-shown').textContent();
  assert.ok(early.length < 'Bake bread you are proud of.'.length, `still typing: "${early}"`);
  await page.waitForFunction(() => document.querySelector('[data-preview="typing-text"] typing-text .typing-shown').textContent === 'Bake bread you are proud of.', null, { timeout: 4000 });
  assert.deepEqual(problems, []);
  await page.close();
});

test('marquee-strip: a seamless loop whose copy is hidden and unfocusable, paused on hover, still under reduced motion', async () => {
  const { page, element, problems } = await open('marquee-strip');
  const copy = element.locator('.marquee-copy');
  assert.equal(await copy.locator('.demo-chip').count(), 6, 'the copy has every item');
  assert.deepEqual(await copy.evaluate((el) => [el.getAttribute('aria-hidden'), el.inert]), ['true', true]);
  const row = element.locator('.marquee-row');
  assert.equal(await row.evaluate((el) => el.getAnimations()[0]?.playState), 'running');
  await element.locator('.marquee').hover();
  assert.equal(await row.evaluate((el) => getComputedStyle(el).animationPlayState), 'paused');
  await element.evaluate((el) => el.querySelector('.marquee-track').append(Object.assign(document.createElement('span'), { className: 'demo-chip', textContent: 'Pied Piper' })));
  await page.waitForTimeout(50);
  assert.equal(await copy.locator('.demo-chip').count(), 7, 'the copy follows the items');
  await element.evaluate((el) => (el.controls = true));
  await element.getByRole('button', { name: 'Pause scrolling' }).click();
  assert.equal(await element.getByRole('button', { name: 'Pause scrolling' }).getAttribute('aria-pressed'), 'true');
  assert.deepEqual(problems, []);
  await page.close();
  const still = await open('marquee-strip', reduce);
  assert.equal(await still.element.locator('.marquee-row').evaluate((el) => el.getAnimations().length), 0);
  assert.equal(await still.element.locator('.marquee-copy').evaluate((el) => getComputedStyle(el).display), 'none');
  await still.page.close();
});

test('tilt-card and spotlight-card follow the pointer, and tilt-card stays flat under reduced motion', async () => {
  for (const reduced of [false, true]) {
    const { page, element, problems } = await open('tilt-card', reduced ? reduce : {});
    const card = element.locator('.tilt');
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
    const tilt = await card.evaluate((el) => [el.style.getPropertyValue('--tilt-x'), el.style.getPropertyValue('--tilt-y')]);
    if (reduced) assert.deepEqual(tilt, ['', '']);
    else assert.ok(parseFloat(tilt[0]) > 0 && parseFloat(tilt[1]) > 0, `tilts toward the top right: ${tilt}`);
    await page.mouse.move(0, 0);
    if (!reduced) assert.equal(await card.evaluate((el) => el.style.getPropertyValue('--tilt-y')), '0deg', 'flat again');
    assert.deepEqual(problems, []);
    await page.close();
  }
  const { page, element, problems } = await open('spotlight-card');
  const card = element.locator('.spotlight');
  const box = await card.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 30);
  assert.deepEqual(await card.evaluate((el) => [el.style.getPropertyValue('--spot-x'), el.classList.contains('spotlight-lit')]), ['20px', true]);
  assert.deepEqual(problems, []);
  await page.close();
});

test('shimmer-button: a real button that submits its form; the sweep stops when disabled and under reduced motion', async () => {
  const { page, problems } = await open('shimmer-button');
  const submitted = await page.evaluate(async () => {
    const form = document.body.appendChild(document.createElement('form'));
    form.innerHTML = '<shimmer-button type="submit" name="intent" value="book">Book</shimmer-button>';
    let data = null;
    form.addEventListener('submit', (event) => { event.preventDefault(); data = Object.fromEntries(new FormData(form, event.submitter)); });
    await new Promise((resolve) => setTimeout(resolve, 50));
    form.querySelector('button').click();
    return data;
  });
  assert.deepEqual(submitted, { intent: 'book' });
  const sweeping = (page) => page.evaluate(() => document.querySelector('[data-preview="shimmer-button"] .shimmer').getAnimations({ subtree: true }).some((animation) => animation.animationName === 'shimmer-sweep'));
  assert.equal(await sweeping(page), true);
  assert.deepEqual(problems, []);
  await page.close();
  const still = await open('shimmer-button', reduce);
  assert.equal(await sweeping(still.page), false);
  await still.page.close();
});

test('shine-border: the beam goes round, is hidden from screen readers, and is still under reduced motion', async () => {
  for (const reduced of [false, true]) {
    const { page, element, problems } = await open('shine-border', reduced ? reduce : {});
    const beam = element.locator('.shine-beam');
    assert.equal(await beam.getAttribute('aria-hidden'), 'true');
    assert.equal(await beam.evaluate((el) => el.getAnimations().length), reduced ? 0 : 1);
    assert.deepEqual(problems, []);
    await page.close();
  }
});
