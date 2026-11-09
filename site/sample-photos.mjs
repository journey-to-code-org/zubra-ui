// Sample "photos" for the image-gallery demo: simple illustrated scenes drawn as SVG and saved as
// JPEGs at different shapes, so the masonry grid and zubra-imager have something real to work
// on. They're drawn here, so the repository holds no images and nothing anyone took.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const hills = (w, h, colors) => colors.map((color, i) => {
  const base = h * (0.55 + i * 0.12);
  const points = Array.from({ length: 7 }, (_, k) => `${(w * k) / 6},${base - Math.sin(k * 1.3 + i * 2) * h * 0.08}`).join(' ');
  return `<polygon points="0,${h} ${points} ${w},${h}" fill="${color}"/>`;
}).join('');

const SCENES = [
  { file: 'hills-at-dusk.jpg', alt: 'Illustration: rolling hills under a pink dusk sky', w: 1800, h: 1200,
    draw: (w, h) => `<defs><linearGradient id="s" x2="0" y2="1"><stop offset="0" stop-color="#2b2d6e"/><stop offset="1" stop-color="#f29e9e"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/><circle cx="${w * 0.7}" cy="${h * 0.5}" r="${h * 0.09}" fill="#ffd6a5"/>${hills(w, h, ['#5a4e8c', '#3d3770', '#262352'])}` },
  { file: 'lighthouse.jpg', alt: 'Illustration: a lighthouse on a cliff above the sea', w: 1200, h: 1800,
    draw: (w, h) => `<rect width="${w}" height="${h}" fill="#9fd3e6"/><rect y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="#2f7ea6"/><polygon points="0,${h * 0.55} ${w * 0.62},${h * 0.6} ${w * 0.7},${h} 0,${h}" fill="#6b5b4b"/><rect x="${w * 0.28}" y="${h * 0.3}" width="${w * 0.12}" height="${h * 0.27}" fill="#f4f1ea"/><rect x="${w * 0.28}" y="${h * 0.38}" width="${w * 0.12}" height="${h * 0.04}" fill="#c0392b"/><rect x="${w * 0.28}" y="${h * 0.47}" width="${w * 0.12}" height="${h * 0.04}" fill="#c0392b"/><rect x="${w * 0.265}" y="${h * 0.26}" width="${w * 0.15}" height="${h * 0.045}" fill="#333"/><circle cx="${w * 0.34}" cy="${h * 0.282}" r="${w * 0.03}" fill="#ffe08a"/>` },
  { file: 'mountain-lake.jpg', alt: 'Illustration: a mountain reflected in a still lake', w: 1920, h: 1080,
    draw: (w, h) => `<rect width="${w}" height="${h * 0.55}" fill="#cfe8f3"/><polygon points="${w * 0.15},${h * 0.55} ${w * 0.5},${h * 0.1} ${w * 0.85},${h * 0.55}" fill="#5d6d7e"/><polygon points="${w * 0.42},${h * 0.2} ${w * 0.5},${h * 0.1} ${w * 0.58},${h * 0.2}" fill="#fff"/><rect y="${h * 0.55}" width="${w}" height="${h * 0.45}" fill="#7fb3c8"/><polygon points="${w * 0.15},${h * 0.55} ${w * 0.5},${h} ${w * 0.85},${h * 0.55}" fill="#6f8796" opacity="0.6"/>` },
  { file: 'dunes.jpg', alt: 'Illustration: desert dunes under a pale midday sun', w: 1600, h: 1200,
    draw: (w, h) => `<rect width="${w}" height="${h}" fill="#f7e3b5"/><circle cx="${w * 0.25}" cy="${h * 0.22}" r="${h * 0.08}" fill="#fff7e0"/>${hills(w, h, ['#e9b872', '#d99a4e', '#b8742f'])}` },
  { file: 'foggy-pines.jpg', alt: 'Illustration: pine trees fading into fog', w: 1200, h: 1600,
    draw: (w, h) => `<rect width="${w}" height="${h}" fill="#dfe6e9"/>${[0.35, 0.55, 0.75].map((y, row) => Array.from({ length: 6 }, (_, k) => { const x = (w * (k + 0.5 + (row % 2) * 0.4)) / 6; const s = w * (0.07 + row * 0.03); return `<polygon points="${x},${h * y - s * 2.6} ${x - s},${h * y + s * 0.6} ${x + s},${h * y + s * 0.6}" fill="${['#a3b5ad', '#6f8f7f', '#2f5d48'][row]}"/>`; }).join('')).join('')}<rect y="${h * 0.85}" width="${w}" height="${h * 0.15}" fill="#2f5d48"/>` },
  { file: 'harbour-night.jpg', alt: 'Illustration: boats in a harbour at night, under a full moon', w: 1400, h: 1400,
    draw: (w, h) => `<rect width="${w}" height="${h}" fill="#141b33"/><circle cx="${w * 0.75}" cy="${h * 0.22}" r="${w * 0.07}" fill="#f5f0d0"/><rect y="${h * 0.62}" width="${w}" height="${h * 0.38}" fill="#1f2d4d"/>${[0.2, 0.45, 0.68].map((x) => `<polygon points="${w * (x - 0.08)},${h * 0.62} ${w * (x + 0.08)},${h * 0.62} ${w * (x + 0.06)},${h * 0.67} ${w * (x - 0.06)},${h * 0.67}" fill="#c9884a"/><rect x="${w * x - 4}" y="${h * 0.45}" width="8" height="${h * 0.17}" fill="#ddd"/><polygon points="${w * x + 6},${h * 0.46} ${w * (x + 0.07)},${h * 0.6} ${w * x + 6},${h * 0.6}" fill="#e8e8e8"/>`).join('')}` },
  { file: 'sunflowers.jpg', alt: 'Illustration: a field of sunflowers under a blue sky', w: 1800, h: 1200,
    draw: (w, h) => `<rect width="${w}" height="${h}" fill="#7cc4f0"/><rect y="${h * 0.5}" width="${w}" height="${h * 0.5}" fill="#4f8a3a"/>${Array.from({ length: 24 }, (_, k) => { const x = (w * ((k % 8) + 0.5)) / 8; const y = h * (0.58 + Math.floor(k / 8) * 0.14); const r = h * (0.035 + Math.floor(k / 8) * 0.012); return `<circle cx="${x}" cy="${y}" r="${r * 1.7}" fill="#f6c431"/><circle cx="${x}" cy="${y}" r="${r * 0.8}" fill="#6b3d1e"/>`; }).join('')}` },
  { file: 'snowy-peak.jpg', alt: 'Illustration: a snowy peak against an evening sky', w: 1280, h: 1600,
    draw: (w, h) => `<defs><linearGradient id="s" x2="0" y2="1"><stop offset="0" stop-color="#3b4a8c"/><stop offset="1" stop-color="#e9a9c2"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/><polygon points="0,${h} ${w * 0.5},${h * 0.25} ${w},${h}" fill="#566a8a"/><polygon points="${w * 0.36},${h * 0.42} ${w * 0.5},${h * 0.25} ${w * 0.64},${h * 0.42} ${w * 0.56},${h * 0.38} ${w * 0.5},${h * 0.44} ${w * 0.44},${h * 0.38}" fill="#fff"/>` },
];

/** Draws the scenes into `dir` (once) with an alt.json, and returns `dir`. */
export async function samplePhotos(dir) {
  mkdirSync(dir, { recursive: true });
  for (const scene of SCENES) {
    const path = join(dir, scene.file);
    if (existsSync(path)) continue;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.w}" height="${scene.h}">${scene.draw(scene.w, scene.h)}</svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(path);
  }
  writeFileSync(join(dir, 'alt.json'), `${JSON.stringify(Object.fromEntries(SCENES.map((scene) => [scene.file, scene.alt])), null, 2)}\n`);
  return dir;
}
