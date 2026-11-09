// zubra-imager on photos made here: one turned sideways by EXIF, one with a GPS location and a
// description, one smaller than the largest width, and one named in alt.json.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { nameToText, processFolder } from '../index.js';

let dir, photos, out, manifest;
const photo = (width, height, color) => sharp({ create: { width, height, channels: 3, background: color } });
const byFile = (name) => manifest.items.find((item) => item.file === name);

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'zubra-imager-'));
  photos = join(dir, 'photos');
  out = join(dir, 'gallery');
  await import('node:fs').then(({ mkdirSync }) => mkdirSync(photos));
  // Stored 1200×800 but EXIF says "rotate 90°": upright it's 800×1200.
  await photo(1200, 800, '#3a6').jpeg().withMetadata({ orientation: 6 }).toFile(join(photos, 'tall-tree.jpg'));
  // A description and a GPS location in its EXIF.
  await photo(2000, 1000, '#36c').jpeg().withExif({
    IFD0: { ImageDescription: 'Fog over the river at dawn', Make: 'Example Camera Co' },
    IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '38/1 25/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '80/1 0/1 0/1' },
  }).toFile(join(photos, 'IMG_0042.jpg'));
  await photo(600, 400, '#c63').png().toFile(join(photos, 'small_red-barn.png'));
  await photo(1000, 1000, '#999').webp().toFile(join(photos, 'bake-sale.webp'));
  writeFileSync(join(photos, 'alt.json'), JSON.stringify({ 'bake-sale.webp': { alt: 'Pies on a folding table', caption: 'Spring bake sale' } }));
  writeFileSync(join(photos, 'notes.txt'), 'not a photo');
  manifest = await processFolder(photos, out, { widths: [480, 960, 1600] });
});
after(() => dir && rmSync(dir, { recursive: true, force: true }));

test('every photo is in the manifest, in file-name order, and nothing else is', () => {
  assert.deepEqual(manifest.items.map((item) => item.file), ['bake-sale.webp', 'IMG_0042.jpg', 'small_red-barn.png', 'tall-tree.jpg']);
});

test('sizes stop at the photo\'s own width, in AVIF and WebP, with one JPEG', async () => {
  const barn = byFile('small_red-barn.png');
  assert.deepEqual(barn.sources.map((source) => source.type), ['image/avif', 'image/webp']);
  assert.deepEqual(barn.sources[1].srcset.split(', ').map((entry) => entry.split(' ')[1]), ['480w', '600w']);
  const river = byFile('IMG_0042.jpg');
  assert.deepEqual(river.sources[0].srcset.split(', ').map((entry) => entry.split(' ')[1]), ['480w', '960w', '1600w']);
  assert.match(river.src, /\.jpg$/);
  assert.equal((await sharp(join(out, river.src)).metadata()).width, 960);
  for (const item of manifest.items) {
    for (const entry of item.sources.flatMap((source) => source.srcset.split(', '))) {
      const [name, width] = entry.split(' ');
      assert.equal((await sharp(join(out, name)).metadata()).width, Number.parseInt(width), name);
    }
  }
});

test('EXIF orientation is applied, and the size reported is the upright one', async () => {
  const tree = byFile('tall-tree.jpg');
  assert.deepEqual([tree.width, tree.height], [800, 1200]);
  const largest = tree.sources[1].srcset.split(', ').at(-1).split(' ')[0];
  const meta = await sharp(join(out, largest)).metadata();
  assert.ok(meta.height > meta.width, `${largest} is upright (${meta.width}×${meta.height})`);
  assert.equal(meta.orientation ?? 1, 1);
});

test('no location or camera details leave the machine', async () => {
  for (const name of readdirSync(out).filter((file) => !file.endsWith('.json'))) {
    const meta = await sharp(join(out, name)).metadata();
    assert.equal(meta.exif, undefined, `${name} has no EXIF`);
  }
  const text = JSON.stringify(manifest);
  assert.doesNotMatch(text, /GPS|Example Camera|38\/1/);
});

test('alt text comes from alt.json, then the photo\'s description, then its name', () => {
  assert.equal(byFile('bake-sale.webp').alt, 'Pies on a folding table');
  assert.equal(byFile('bake-sale.webp').caption, 'Spring bake sale');
  assert.equal(byFile('IMG_0042.jpg').alt, 'Fog over the river at dawn');
  assert.equal(byFile('small_red-barn.png').alt, 'Small red barn');
  assert.equal(nameToText('sunset_over-the-river 2.jpg'), 'Sunset over the river 2');
});

test('each photo gets a tiny placeholder', () => {
  for (const item of manifest.items) {
    assert.match(item.placeholder, /^data:image\/webp;base64,/);
    assert.ok(item.placeholder.length < 1200, `${item.file}: ${item.placeholder.length} chars`);
  }
});

test('a second run skips unchanged photos', async () => {
  const before = Object.fromEntries(readdirSync(out).map((name) => [name, statSync(join(out, name)).mtimeMs]));
  const again = await processFolder(photos, out, { widths: [480, 960, 1600] });
  assert.deepEqual(again.items.map((item) => item.src), manifest.items.map((item) => item.src));
  for (const [name, time] of Object.entries(before)) if (name !== 'gallery.json') assert.equal(statSync(join(out, name)).mtimeMs, time, name);
});

test('the CLI explains itself and reports a missing folder plainly', async () => {
  const cli = join(import.meta.dirname, '..', 'cli.js');
  const run = promisify(execFile);
  const help = await run(process.execPath, [cli, '--help']);
  assert.match(help.stdout, /alt\.json/);
  await assert.rejects(run(process.execPath, [cli, join(dir, 'nope')]), (error) => /No folder at/.test(error.stderr));
  const made = await run(process.execPath, [cli, photos, '--out', join(dir, 'cli-out'), '--widths', '300', '--formats', 'webp']);
  assert.match(made.stdout, /4 photos/);
});
