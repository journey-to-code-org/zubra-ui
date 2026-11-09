// zubra-imager: a folder of photos in, web-ready images and a gallery.json out.
//
// For each photo it:
//   - turns it upright (EXIF orientation) and strips its metadata, so no location or camera serial
//     leaves the machine;
//   - writes it at each width up to its own (AVIF and WebP), plus one JPEG for old browsers;
//   - takes the alt text and caption from a sidecar file (alt.json), the photo's own description,
//     or its file name, in that order;
//   - makes a tiny blurred placeholder to show while it loads.
//
// gallery.json is what <image-gallery src="gallery.json"> reads: { items: [{ src, srcset, sources,
// width, height, alt, caption, placeholder, taken }] }, with URLs relative to the manifest.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import exifReader from 'exif-reader';

export const DEFAULTS = { widths: [480, 960, 1600], formats: ['avif', 'webp'], quality: { avif: 55, webp: 78, jpeg: 80 } };
const PHOTOS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.heic', '.heif']);
const TYPES = { avif: 'image/avif', webp: 'image/webp', jpeg: 'image/jpeg' };

/** "sunset_over-the-river 2.jpg" → "Sunset over the river 2" */
export const nameToText = (file) => {
  const text = basename(file, extname(file)).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** The photo's own description and date, from EXIF (nothing else is read or kept). */
function described(exif) {
  if (!exif) return {};
  try {
    const tags = exifReader(exif);
    const text = (value) => (typeof value === 'string' && value.trim() && !/^(n\/a|untitled|default)$/i.test(value.trim()) ? value.trim() : undefined);
    const date = tags.Photo?.DateTimeOriginal ?? tags.Image?.DateTime;
    return {
      description: text(tags.Image?.ImageDescription),
      taken: date instanceof Date && !isNaN(date) ? date.toISOString().slice(0, 10) : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Process every photo in `input` into `out`. Returns the manifest (also written as gallery.json).
 * Options: widths, formats ('avif', 'webp'), quality, sort ('name' | 'taken'), log (a function).
 */
export async function processFolder(input, out, options = {}) {
  const widths = [...(options.widths ?? DEFAULTS.widths)].sort((a, b) => a - b);
  const formats = options.formats ?? DEFAULTS.formats;
  const quality = { ...DEFAULTS.quality, ...options.quality };
  const log = options.log ?? (() => {});
  input = resolve(input);
  out = resolve(out);
  if (!existsSync(input) || !statSync(input).isDirectory()) throw new Error(`No folder at ${input}`);
  mkdirSync(out, { recursive: true });

  // alt.json: { "file.jpg": "Alt text" } or { "file.jpg": { "alt": "…", "caption": "…" } }
  const sidecarPath = join(input, 'alt.json');
  const sidecar = existsSync(sidecarPath) ? JSON.parse(readFileSync(sidecarPath, 'utf8')) : {};
  const files = readdirSync(input).filter((file) => PHOTOS.has(extname(file).toLowerCase())).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!files.length) throw new Error(`No photos in ${input} (${[...PHOTOS].join(', ')})`);

  const items = [];
  for (const file of files) {
    const source = readFileSync(join(input, file));
    // Outputs are named by content and settings, so an unchanged photo is skipped next time.
    const hash = createHash('sha256').update(source).update(JSON.stringify({ widths, formats, quality })).digest('hex').slice(0, 10);
    const stem = `${basename(file, extname(file)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'photo'}-${hash}`;
    const upright = sharp(source, { failOn: 'none' }).rotate(); // applies EXIF orientation
    const meta = await sharp(source, { failOn: 'none' }).metadata();
    const swap = (meta.orientation ?? 1) >= 5; // 90° turns swap width and height
    const width = swap ? meta.height : meta.width;
    const height = swap ? meta.width : meta.height;
    const sizes = [...new Set([...widths.filter((size) => size < width), Math.min(width, widths.at(-1))])];

    const write = async (format, size) => {
      const name = `${stem}-${size}.${format === 'jpeg' ? 'jpg' : format}`;
      const path = join(out, name);
      if (!existsSync(path)) await upright.clone().resize({ width: size, withoutEnlargement: true }).toFormat(format, { quality: quality[format] }).toFile(path);
      return name;
    };
    const sources = [];
    for (const format of formats) {
      const names = [];
      for (const size of sizes) names.push(`${await write(format, size)} ${size}w`);
      sources.push({ type: TYPES[format], srcset: names.join(', ') });
    }
    // One JPEG, at the middle size, for browsers without AVIF or WebP.
    const fallbackSize = sizes[Math.floor((sizes.length - 1) / 2)];
    const src = await write('jpeg', fallbackSize);
    const tiny = await upright.clone().resize({ width: 16 }).blur(1).webp({ quality: 40 }).toBuffer();

    const extra = typeof sidecar[file] === 'string' ? { alt: sidecar[file] } : sidecar[file] ?? {};
    const { description, taken } = described(meta.exif);
    items.push({
      src,
      srcset: sources.find((entry) => entry.type === TYPES.webp)?.srcset ?? sources[0]?.srcset,
      sources,
      width,
      height,
      alt: extra.alt ?? description ?? nameToText(file),
      ...(extra.caption ? { caption: extra.caption } : {}),
      placeholder: `data:image/webp;base64,${tiny.toString('base64')}`,
      ...(taken ? { taken } : {}),
      file,
    });
    log(`${file} → ${sizes.length} sizes × ${formats.length + 1} formats`);
  }
  if (options.sort === 'taken') items.sort((a, b) => (a.taken ?? '').localeCompare(b.taken ?? ''));
  const manifest = { generator: 'zubra-imager', items };
  writeFileSync(join(out, 'gallery.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  log(`${items.length} photos → ${relative(process.cwd(), join(out, 'gallery.json')) || 'gallery.json'}`);
  return manifest;
}
