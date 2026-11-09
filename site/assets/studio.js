// The theme studio: a theme is built up as overrides on a starting theme, compiled with the same
// compiler the build uses (theme-compiler.js), previewed on real components in light and dark,
// checked for contrast, and kept in this browser and in a shareable link (#theme=…).
import { compileTheme, resolveTheme } from './theme-compiler.js';

const FONTS = {
  inherit: ["The starting theme's", ''],
  sans: ['System sans', 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'],
  humanist: ['Humanist sans', 'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", source-sans-pro, sans-serif'],
  geometric: ['Geometric sans', 'Avenir, Montserrat, Corbel, "URW Gothic", source-sans-pro, sans-serif'],
  rounded: ['Rounded', 'ui-rounded, "SF Pro Rounded", Nunito, Quicksand, "Varela Round", system-ui, sans-serif'],
  serif: ['Book serif', '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif'],
  slab: ['Slab serif', 'Rockwell, "Rockwell Nova", "Roboto Slab", "DejaVu Serif", serif'],
  mono: ['Monospace', 'ui-monospace, "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace'],
};
const MOTION = {
  inherit: ["The starting theme's", null],
  snappy: ['Snappy', { durationFast: '80ms', durationNormal: '120ms', durationSlow: '200ms', easeOut: 'cubic-bezier(0.3, 0, 0.2, 1)' }],
  standard: ['Standard', { durationFast: '150ms', durationNormal: '200ms', durationSlow: '400ms', easeOut: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }],
  gentle: ['Gentle', { durationFast: '180ms', durationNormal: '280ms', durationSlow: '560ms', easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)' }],
  bouncy: ['Bouncy', { durationFast: '140ms', durationNormal: '240ms', durationSlow: '420ms', easeOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }],
  none: ['None', { durationFast: '0ms', durationNormal: '0ms', durationSlow: '0ms' }],
};
const GROUPS = [
  ['Page', [['background', 'Page'], ['foreground', 'Text'], ['muted', 'Muted surface'], ['mutedForeground', 'Muted text'], ['border', 'Borders'], ['input', 'Field borders']]],
  ['Cards and menus', [['card', 'Card'], ['cardForeground', 'Card text'], ['popover', 'Menu'], ['popoverForeground', 'Menu text']]],
  ['Brand', [['primary', 'Primary'], ['primaryForeground', 'Text on primary'], ['secondary', 'Secondary'], ['secondaryForeground', 'Text on secondary'], ['accent', 'Hover'], ['accentForeground', 'Text on hover'], ['ring', 'Focus ring'], ['destructive', 'Danger']]],
  ['Charts', [['chart1', 'Chart 1'], ['chart2', 'Chart 2'], ['chart3', 'Chart 3']]],
];
const PAIRS = [['foreground', 'background', 'Text on the page'], ['mutedForeground', 'background', 'Muted text on the page'], ['cardForeground', 'card', 'Text on a card'], ['popoverForeground', 'popover', 'Text in a menu'], ['primaryForeground', 'primary', 'Text on primary'], ['secondaryForeground', 'secondary', 'Text on secondary'], ['accentForeground', 'accent', 'Text on hover'], ['input', 'background', 'Field borders against the page']];
// A brand colour and the text on it: when the text stops being readable, the studio picks it again.
const TEXT_ON = { primary: 'primaryForeground', secondary: 'secondaryForeground', accent: 'accentForeground', destructive: null };
const STORE = 'zubra-ui:studio';
const store = { get: (key) => { try { return localStorage.getItem(key); } catch { return null; } }, set: (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch {} } };

// ---- colours: any CSS colour to sRGB through a canvas, then hex, OKLCH and contrast

const canvas = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
// A see-through colour is measured as it shows: over what's behind it.
function rgb(css, over = '#fff') {
  canvas.clearRect(0, 0, 1, 1);
  canvas.fillStyle = over;
  canvas.fillRect(0, 0, 1, 1);
  canvas.fillStyle = '#000';
  canvas.fillStyle = css;
  canvas.fillRect(0, 0, 1, 1);
  return [...canvas.getImageData(0, 0, 1, 1).data.slice(0, 3)];
}
const hex = (css) => `#${rgb(css).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
const linear = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
function luminance(rgbValue) { const [r, g, b] = rgbValue.map(linear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
/** Contrast of a colour on a background (the colour laid over it, if it's see-through). */
function ratio(front, back) {
  const behind = `rgb(${rgb(back).join(' ')})`;
  const [x, y] = [luminance(rgb(front, behind)), luminance(rgb(behind))].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
/** sRGB → OKLCH [L, C, H], for deriving a dark scheme from a light one. */
function oklch(css) {
  const [r, g, b] = rgb(css).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}
const css = ([L, C, H]) => `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${H.toFixed(1)})`;
/** A dark scheme with the light one's hues: surfaces dark, text light, brand colours lifted. */
function deriveDark(light) {
  const at = (key, L, chroma = 1) => { const [, C, H] = oklch(light[key]); return css([L, Math.min(C * chroma, 0.2), H]); };
  const [pL, pC, pH] = oklch(light.primary);
  const primary = css([Math.max(0.72, pL), pC, pH]);
  return {
    background: at('background', 0.17, 0.6), foreground: at('foreground', 0.96, 0.4), card: at('card', 0.21, 0.6), cardForeground: at('cardForeground', 0.96, 0.4),
    popover: at('popover', 0.21, 0.6), popoverForeground: at('popoverForeground', 0.96, 0.4), muted: at('muted', 0.27, 0.8), mutedForeground: at('mutedForeground', 0.74, 0.6),
    border: at('border', 0.33, 0.8), input: at('input', 0.4, 0.8), primary, primaryForeground: css([0.18, Math.min(pC, 0.05), pH]),
    secondary: at('secondary', 0.29, 0.8), secondaryForeground: at('secondaryForeground', 0.95, 0.4), accent: at('accent', 0.3, 0.8), accentForeground: at('accentForeground', 0.95, 0.4),
    ring: primary, destructive: at('destructive', 0.7), chart1: at('chart1', 0.75), chart2: at('chart2', 0.75), chart3: at('chart3', 0.75),
  };
}
const slugOf = (label) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/^(\d)/, 't-$1') || 'my-theme';
// A theme in the URL: base64url of its JSON.
const encode = (value) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = (text) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));

export async function startStudio() {
  const $ = (selector) => document.querySelector(selector);
  const index = await (await fetch('../themes/sets/index.json')).json();
  const themes = Object.fromEntries(await Promise.all(index.map(async ({ name }) => [name, await (await fetch(`../themes/sets/${name}.json`)).json()])));
  const fresh = () => ({ auto: { light: {}, dark: {} }, base: 'zinc', label: 'My theme', colors: { light: {}, dark: {} }, font: 'inherit', heading: 'inherit', radius: null, motion: 'inherit', backdrop: 'mesh' });
  let state = fresh();
  try {
    const shared = location.hash.match(/theme=([\w-]+)/)?.[1];
    state = { ...state, ...(shared ? decode(shared) : JSON.parse(store.get(STORE) ?? 'null') ?? {}) };
  } catch {}
  state.auto ??= { light: {}, dark: {} };
  let scheme = 'light';

  /** The theme as a theme file: what differs from where it started. */
  const themeFile = () => {
    const file = { label: state.label, description: `Made in the theme studio from ${themes[state.base]?.label ?? state.base}.`, extends: state.base };
    const colors = Object.fromEntries(['light', 'dark'].filter((s) => Object.keys(state.colors[s]).length).map((s) => [s, state.colors[s]]));
    if (Object.keys(colors).length) file.colors = colors;
    if (FONTS[state.font]?.[1] || FONTS[state.heading]?.[1]) file.fonts = { ...(FONTS[state.font]?.[1] ? { body: FONTS[state.font][1] } : {}), ...(FONTS[state.heading]?.[1] ? { heading: FONTS[state.heading][1] } : {}) };
    const tokens = { ...(state.radius != null ? { radius: `${state.radius}rem` } : {}), ...(MOTION[state.motion]?.[1] ?? {}) };
    if (Object.keys(tokens).length) file.tokens = tokens;
    file.backdrop = state.backdrop;
    return file;
  };
  const resolved = () => resolveTheme({ ...themes, custom: themeFile() }, 'custom');

  // ---- controls
  const base = $('#studio-base');
  base.options = index.map(({ name, label }) => ({ value: name, label }));
  const label = $('#studio-label');
  const schemeControl = $('#studio-scheme');
  schemeControl.options = [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }];
  const option = (map) => Object.entries(map).map(([value, [text]]) => ({ value, label: text }));
  $('#studio-font').options = option(FONTS);
  $('#studio-heading').options = option(FONTS);
  $('#studio-motion').options = option(MOTION);
  $('#studio-backdrop').options = ['grid', 'dots', 'mesh', 'grain', 'aurora'].map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
  const radius = $('#studio-radius');
  Object.assign(radius, { min: 0, max: 1.5, step: 0.05 });

  const colours = $('#studio-colours');
  colours.innerHTML = GROUPS.map(([heading, keys]) => `<div class="studio-group"><p class="studio-group-name">${heading}</p>${keys.map(([key, text]) => `<label class="studio-colour"><input type="color" data-key="${key}" aria-label="${text}"><span>${text}</span><input type="text" class="studio-css" data-css="${key}" aria-label="${text} (CSS colour)" spellcheck="false"></label>`).join('')}</div>`).join('');

  const status = (text) => { $('#studio-status').textContent = text; };
  const flash = (button, text) => {
    button.dataset.label ??= button.textContent;
    button.textContent = text;
    clearTimeout(button.flashing);
    button.flashing = setTimeout(() => { button.textContent = button.dataset.label; }, 2500);
  };
  function setColour(key, value) {
    if (!value) delete state.colors[scheme][key];
    else state.colors[scheme][key] = value;
    delete state.auto[scheme][key];
    // A new brand colour gets readable text on it, unless that text was chosen by hand.
    const textKey = TEXT_ON[key];
    if (textKey && (!(textKey in state.colors[scheme]) || state.auto[scheme][textKey])) {
      const c = resolved().colors?.[scheme] ?? {};
      if (c[key] && c[textKey] && ratio(c[textKey], c[key]) < 4.5) {
        const best = [c.foreground, c.background, '#fff', '#000'].filter(Boolean).sort((a, b) => ratio(b, c[key]) - ratio(a, c[key]))[0];
        state.colors[scheme][textKey] = best;
        state.auto[scheme][textKey] = true;
        status(`Changed the text on ${key} so it stays readable.`);
      }
    }
    render();
  }
  colours.addEventListener('input', (event) => { if (event.target.dataset.key) setColour(event.target.dataset.key, event.target.value); });
  colours.addEventListener('change', (event) => {
    const key = event.target.dataset.css;
    if (!key) return;
    const value = event.target.value.trim();
    // Only a value the browser reads as a colour (and nothing that could end the declaration).
    if (value && (!CSS.supports('color', value) || /[;{}<>]/.test(value))) {
      event.target.setAttribute('aria-invalid', 'true');
      event.target.title = `"${value}" isn't a CSS colour: try #1d4ed8, rgb(29 78 216) or oklch(0.5 0.2 260).`;
      status(event.target.title);
      return;
    }
    event.target.removeAttribute('aria-invalid');
    event.target.removeAttribute('title');
    setColour(key, value);
  });
  base.addEventListener('valuechange', (event) => { state.base = event.detail; render(); });
  label.addEventListener('valuechange', (event) => { state.label = event.detail || 'My theme'; render(); });
  schemeControl.addEventListener('valuechange', (event) => { scheme = event.detail; render(); });
  $('#studio-font').addEventListener('valuechange', (event) => { state.font = event.detail; render(); });
  $('#studio-heading').addEventListener('valuechange', (event) => { state.heading = event.detail; render(); });
  $('#studio-motion').addEventListener('valuechange', (event) => { state.motion = event.detail; render(); });
  $('#studio-backdrop').addEventListener('valuechange', (event) => { state.backdrop = event.detail; render(); });
  radius.addEventListener('valuechange', (event) => { state.radius = event.detail; render(); });
  // Dark colours set by hand are replaced only on a second press.
  const derive = $('#studio-derive');
  derive.addEventListener('click', () => {
    if (Object.keys(state.colors.dark).length && !derive.dataset.confirm) {
      derive.dataset.confirm = '';
      flash(derive, 'Replace your dark colours? Press again');
      setTimeout(() => delete derive.dataset.confirm, 2500);
      return;
    }
    delete derive.dataset.confirm;
    clearTimeout(derive.flashing);
    if (derive.dataset.label) derive.textContent = derive.dataset.label;
    state.colors.dark = deriveDark(resolved().colors.light);
    state.auto.dark = {};
    scheme = 'dark';
    render();
    status('Made the dark colours from the light ones. They show in the dark preview; change any of them here.');
    $('#studio-dark').scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  $('#studio-reset').addEventListener('click', () => {
    state = fresh();
    history.replaceState(null, '', location.pathname);
    render();
    $('#studio-status').textContent = 'Started over from Zinc.';
  });
  $('#studio-share').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#theme=${encode(state)}`;
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); status('Copied a link to this theme.'); flash($('#studio-share'), 'Copied'); } catch { status('The link is in the address bar: copy it from there.'); }
  });
  $('#studio-use').addEventListener('click', () => {
    store.set('zubra-ui:custom-css', compileTheme({ ...themes, custom: themeFile() }, 'custom'));
    store.set('zubra-ui:look', 'custom');
    document.documentElement.dataset.theme = 'custom';
    status(`${state.label} is now the look for this site, in this browser. Pick another under Theme to switch back.`);
    flash($('#studio-use'), 'In use on this site');
  });

  function render() {
    const theme = resolved();
    const slug = slugOf(state.label);
    // The preview: one copy fixed to each scheme, so the page's own light or dark mode can't reach in.
    const fixed = (colors, colorScheme) => ({ colorScheme, colors: { light: colors, dark: colors }, fonts: theme.fonts, tokens: theme.tokens });
    $('#custom-theme').textContent = compileTheme({ 'preview-light': fixed(theme.colors?.light ?? {}, 'light'), 'preview-dark': fixed(theme.colors?.dark ?? {}, 'dark') }, 'preview-light')
      + compileTheme({ 'preview-dark': fixed(theme.colors?.dark ?? {}, 'dark') }, 'preview-dark');
    for (const pattern of document.querySelectorAll('.studio-look backdrop-pattern')) pattern.pattern = state.backdrop;
    // Controls show the current values.
    base.value = state.base;
    if (label.value !== state.label) label.value = state.label;
    schemeControl.value = scheme;
    $('#studio-font').value = state.font;
    $('#studio-heading').value = state.heading;
    $('#studio-motion').value = state.motion;
    $('#studio-backdrop').value = state.backdrop;
    radius.value = state.radius ?? parseFloat(theme.tokens?.radius ?? '0.625');
    $('#studio-scheme-hint').textContent = scheme === 'dark' ? 'The colours under .dark (or for a dark-first theme, its default).' : 'The colours by default (for a dark-first theme, under .light).';
    const values = theme.colors?.[scheme] ?? {};
    for (const input of colours.querySelectorAll('[data-key]')) {
      const value = values[input.dataset.key];
      if (value) input.value = hex(value);
      input.closest('.studio-colour').classList.toggle('studio-changed', input.dataset.key in state.colors[scheme]);
    }
    for (const input of colours.querySelectorAll('[data-css]')) if (document.activeElement !== input) input.value = values[input.dataset.css] ?? '';
    // Contrast, both schemes.
    // Text needs 4.5:1. Field borders are advice: 3:1 helps people find the fields, and many themes
    // (shadcn's own) go lighter, so a low one is a warning rather than a failure.
    let failing = 0;
    $('#studio-contrast tbody').innerHTML = PAIRS.map(([text, back, name]) => {
      const cells = ['light', 'dark'].map((s) => {
        const c = theme.colors?.[s] ?? {};
        if (!c[text] || !c[back]) return '<td>–</td>';
        const value = ratio(c[text], c[back]);
        const border = text === 'input';
        const passes = value >= (border ? 3 : 4.5);
        if (!passes && !border) failing += 1;
        const badge = passes ? '<status-badge variant="success">Passes</status-badge>' : border ? '<status-badge variant="warning">Faint</status-badge>' : '<status-badge variant="danger">Too low</status-badge>';
        return `<td><span class="studio-swatch" aria-hidden="true" style="background:${c[back]};color:${c[text]}">${border ? '▬' : 'Aa'}</span> ${value.toFixed(2)}:1 ${badge}</td>`;
      });
      return `<tr><th scope="row">${name}</th>${cells.join('')}</tr>`;
    }).join('');
    $('#studio-warning').textContent = failing ? `${failing === 1 ? 'One pair is' : `${failing} pairs are`} too low to read under Contrast: fix ${failing === 1 ? 'it' : 'them'} before you use this theme.` : '';
    // What to take away.
    const file = themeFile();
    $('#studio-json').textContent = `${JSON.stringify(file, null, 2)}\n`;
    $('#studio-json-name').textContent = `themes/sets/${slug}.json`;
    $('#studio-css').textContent = compileTheme({ ...themes, [slug]: file }, slug);
    $('#studio-slug').textContent = slug;
    store.set(STORE, JSON.stringify(state));
  }
  render();
}
