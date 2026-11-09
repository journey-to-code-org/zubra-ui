#!/usr/bin/env node
// npx zubra-imager <photos> [--out <dir>] [--widths 480,960,1600] [--formats avif,webp] [--sort taken]
import { processFolder, DEFAULTS } from './index.js';

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const input = args.find((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--'));

if (!input || args.includes('--help') || args.includes('-h')) {
  console.log(`zubra-imager: a folder of photos in, web-ready images and gallery.json out.

  npx zubra-imager <photos> [options]

  --out <dir>          where to write (default: <photos>/../gallery)
  --widths <list>      sizes to make, in pixels (default: ${DEFAULTS.widths.join(',')})
  --formats <list>     avif, webp or both (default: ${DEFAULTS.formats.join(',')}); a JPEG is always made too
  --sort taken         order by the date each photo was taken (default: by file name)

Alt text comes from alt.json in the photos folder ({ "beach.jpg": "Kids on the beach at dusk" },
or { "beach.jpg": { "alt": "…", "caption": "…" } }), then the photo's own description, then its
file name. Location and camera details are stripped from every image.

Then: <image-gallery src="gallery/gallery.json"></image-gallery>`);
  process.exit(input || args.includes('--help') || args.includes('-h') ? 0 : 1);
}

const list = (value) => value?.split(',').map((part) => part.trim()).filter(Boolean);
try {
  await processFolder(input, option('--out') ?? `${input.replace(/\/$/, '')}/../gallery`, {
    widths: list(option('--widths'))?.map(Number),
    formats: list(option('--formats')),
    sort: option('--sort'),
    log: (line) => console.log(line),
  });
} catch (error) {
  console.error(`zubra-imager: ${error.message}`);
  process.exit(1);
}
