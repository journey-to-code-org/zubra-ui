// The theme compiler, shared by the build (scripts/themes.mjs) and the site's theme editor, so a
// theme made on the site is exactly what the build would write. No Node or DOM APIs.

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/([a-z])(\d)/g, '$1-$2');
// Token names that become CSS variables other than `--<kebab>`.
const TOKENS = { radius: '--radius', durationFast: '--duration-fast', durationNormal: '--duration-normal', durationSlow: '--duration-slow', easeOut: '--ease-out' };

/** A theme with everything it inherits merged in (`extends`, nearest last). */
export function resolveTheme(themes, name, seen = []) {
  const theme = themes[name];
  if (!theme) throw new Error(`no theme "${name}"`);
  if (seen.includes(name)) throw new Error(`themes extend each other in a loop: ${[...seen, name].join(' → ')}`);
  if (!theme.extends) return theme;
  const base = resolveTheme(themes, theme.extends, [...seen, name]);
  return {
    ...base,
    ...theme,
    colors: { light: { ...base.colors?.light, ...theme.colors?.light }, dark: { ...base.colors?.dark, ...theme.colors?.dark } },
    fonts: { ...base.fonts, ...theme.fonts },
    tokens: { ...base.tokens, ...theme.tokens },
  };
}

const block = (selector, declarations) => `${selector} {\n${declarations.map((line) => `  ${line}`).join('\n')}\n}\n`;
const vars = (colors = {}) => Object.entries(colors).map(([key, value]) => `--${kebab(key)}: ${value};`);
// Theme values go into CSS: refuse anything that could end a declaration or a rule.
const safe = (value, where) => {
  if (/[;{}<>]|\/\*/.test(String(value))) throw new Error(`${where}: "${value}" can't contain ; { } < > or comments`);
  return value;
};

/** The CSS for one theme: its variables, fonts and colour scheme, scoped to `[data-theme="<name>"]`. */
export function compileTheme(themes, name) {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) throw new Error(`theme names are lowercase words with hyphens: "${name}"`);
  const theme = resolveTheme(themes, name);
  for (const scheme of ['light', 'dark']) for (const [key, value] of Object.entries(theme.colors?.[scheme] ?? {})) safe(value, `${name}.colors.${scheme}.${key}`);
  for (const [key, value] of Object.entries({ ...theme.fonts, ...theme.tokens })) safe(value, `${name}.${key}`);
  const scope = `[data-theme="${name}"]`;
  const dark = `.dark ${scope}, ${scope}.dark`;
  const first = theme.colorScheme === 'dark' ? 'dark' : 'light';
  const second = first === 'dark' ? 'light' : 'dark';
  const fonts = theme.fonts ?? {};
  const base = [
    ...vars(theme.colors?.[first]),
    ...Object.entries(theme.tokens ?? {}).map(([key, value]) => `${TOKENS[key] ?? `--${kebab(key)}`}: ${value};`),
    ...(fonts.body ? [`--font-body: ${fonts.body};`] : []),
    ...(fonts.heading ? [`--font-heading: ${fonts.heading};`] : []),
    ...(fonts.mono ? [`--font-mono: ${fonts.mono};`] : []),
    `color-scheme: ${first};`,
    'background-color: var(--background);',
    'color: var(--foreground);',
    ...(fonts.body ? ['font-family: var(--font-body);'] : []),
  ];
  // The other scheme: `.dark` for a light-first theme; `.light` for a dark-first one.
  const other = first === 'light' ? dark : `.light ${scope}, ${scope}.light`;
  const parts = [
    `/* ${theme.label ?? name}${theme.description ? `: ${theme.description}` : ''} */\n`,
    block(scope, base),
    block(other, [...vars(theme.colors?.[second]), `color-scheme: ${second};`]),
  ];
  if (fonts.heading) parts.push(block(`${scope} :is(h1, h2, h3, h4)`, ['font-family: var(--font-heading);', ...(theme.tokens?.headingWeight ? [`font-weight: ${theme.tokens.headingWeight};`] : [])]));
  if (fonts.mono) parts.push(block(`${scope} :is(code, kbd, pre, samp)`, ['font-family: var(--font-mono);']));
  return parts.join('\n');
}
