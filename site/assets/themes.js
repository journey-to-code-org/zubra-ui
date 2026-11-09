// The themes page's editor: start from a theme, change the accent, page, text, corners, font and
// motion, and see it on the "Yours" section at once. The CSS comes from the same compiler the
// build uses (theme-compiler.js), so what you copy is what the build would write.
import { compileTheme } from './theme-compiler.js';

const FONTS = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  rounded: 'ui-rounded, "SF Pro Rounded", Nunito, Quicksand, system-ui, sans-serif',
  mono: 'ui-monospace, "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace',
};
const MOTION = {
  snappy: { durationFast: '80ms', durationNormal: '120ms', durationSlow: '200ms', easeOut: 'cubic-bezier(0.3, 0, 0.2, 1)' },
  gentle: { durationFast: '180ms', durationNormal: '280ms', durationSlow: '560ms', easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  bouncy: { durationFast: '140ms', durationNormal: '240ms', durationSlow: '420ms', easeOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  none: { durationFast: '0ms', durationNormal: '0ms', durationSlow: '0ms' },
};

/** Black or white, whichever reads better on a hex colour (for the accent's text). */
function onColour(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (1.05 / (luminance + 0.05)) > ((luminance + 0.05) / 0.05) ? '#ffffff' : '#0a0a0a';
}

export async function startEditor() {
  const base = './sets/';
  const index = await (await fetch('../themes/sets/index.json')).json();
  const themes = Object.fromEntries(await Promise.all(index.map(async ({ name }) => [name, await (await fetch(`../themes/sets/${name}.json`)).json()])));
  const $ = (selector) => document.querySelector(selector);
  const from = $('#editor-base');
  const font = $('#editor-font');
  const motion = $('#editor-motion');
  const radius = $('#editor-radius');
  const output = $('#editor-radius-out');
  from.options = index.map(({ name, label }) => ({ value: name, label }));
  from.value = 'zinc';
  font.options = [{ value: 'inherit', label: "The theme's own" }, ...Object.keys(FONTS).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))];
  font.value = 'inherit';
  motion.options = [{ value: 'inherit', label: "The theme's" }, ...Object.keys(MOTION).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }))];
  motion.value = 'inherit';

  const render = () => {
    const primary = $('#editor-primary').value;
    const theme = {
      label: 'Yours',
      extends: from.value,
      colors: { light: { primary, primaryForeground: onColour(primary), ring: primary, background: $('#editor-background').value, foreground: $('#editor-foreground').value, chart1: primary } },
      tokens: { radius: `${radius.value}rem`, ...(MOTION[motion.value] ?? {}) },
      ...(FONTS[font.value] ? { fonts: { body: FONTS[font.value], heading: FONTS[font.value] } } : {}),
    };
    output.value = `${radius.value}rem`;
    try {
      const css = compileTheme({ ...themes, custom: theme }, 'custom');
      $('#custom-theme').textContent = css;
      $('#editor-json').textContent = `${JSON.stringify(theme, null, 2)}\n`;
      $('#editor-css').textContent = css;
      $('#editor-status').textContent = '';
    } catch (error) {
      $('#editor-status').textContent = error.message;
    }
  };
  // When you pick a theme to start from, the colour inputs take its light values (where they're hex).
  from.addEventListener('valuechange', () => {
    const light = { ...themes.zinc.colors.light, ...themes[from.value]?.colors?.light };
    const hex = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(value ?? '') ? value : fallback);
    $('#editor-primary').value = hex(light.primary, $('#editor-primary').value);
    render();
  });
  $('#editor').addEventListener('input', render);
  for (const control of [font, motion]) control.addEventListener('valuechange', render);
  void base;
  render();
}
