# zubra-imager

A folder of photos in; web-ready images and a `gallery.json` out, for [Zubra UI](https://github.com/journey-to-code-org/zubra-ui)'s `<image-gallery>`.

```sh
npx zubra-imager photos/ --out public/gallery
```

```html
<image-gallery src="gallery/gallery.json"></image-gallery>
```

## For each photo

- **Upright and private.** It applies the EXIF orientation, then strips all metadata. No GPS location, camera serial or date is in the images it writes.
- **Several sizes:** AVIF and WebP at each width up to the photo's own (480, 960 and 1600 by default), and one JPEG for old browsers.
- **Alt text:** from `alt.json` in the photos folder, then the photo's own EXIF description, then its file name (`red-barn.jpg` becomes "Red barn").
- **A placeholder:** a 16px blurred WebP, inlined in the manifest, shown while the photo loads.
- **Skips unchanged photos:** outputs are named by content and settings, so a second run skips photos that haven't changed.

```json
{ "beach.jpg": "Kids on the beach at dusk",
  "barn.jpg": { "alt": "A red barn in snow", "caption": "January, the morning after the storm" } }
```

## Options

| | |
|---|---|
| `--out <dir>` | where to write (default: `gallery/` beside the photos folder) |
| `--widths 480,960,1600` | sizes to make, in pixels |
| `--formats avif,webp` | modern formats to make (a JPEG is always made) |
| `--sort taken` | order by the date taken instead of the file name |

## From code

```js
import { processFolder } from 'zubra-imager';
const { items } = await processFolder('photos', 'public/gallery', { widths: [640, 1280] });
```

Each item is `{ src, srcset, sources: [{ type, srcset }], width, height, alt, caption?, placeholder, taken?, file }`. URLs are relative to `gallery.json`.

Uses [sharp](https://sharp.pixelplumbing.com/). ISC licence. By Mikey Nichols.
