// Builds Zubra UI into dist/:
//
//   dist/modules/<name>.js      each component compiled to a standard ES module (it imports @zubra/runtime)
//   dist/r/<name>.json          a shadcn registry item: `npx shadcn add <site>/r/<name>.json`
//   dist/r/src/<name>.json      the same component as .zb source, for Zubra projects
//   dist/elements/<name>.js     the component as one plain custom element, with no runtime (`--emit element`)
//   dist/r/element/<name>.json  that file as a registry item, with no dependencies
//   dist/cdn/<name>.js          the plain element for a <script> tag straight from the site, no build:
//                               its one possible package import points at the site's copy of the runtime
//   dist/r/theme.json           the default theme (shadcn/ui's variables) as a CSS file
//   dist/r/registry.json        the registry's index, in shadcn's registry.json format
//   dist/themes/*.css           the themes, for a <link>
//   dist/themes/sets/<name>.css a scoped theme (data-theme="<name>"), from themes/sets/<name>.json
//   dist/r/themes/<name>.json   that theme as a registry item
//
//   node scripts/build.mjs [--base-url https://example.github.io/wcl] [--out dist]
//
// --base-url is where dist/ will be served: registry items name their dependencies (the theme, other
// components) by URL. It defaults to $ZUBRA_UI_URL, then http://127.0.0.1:4174 (scripts/serve.mjs).
import { compileFile } from '@zubra/compiler';
import { compileTheme, loadThemes } from './themes.mjs';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const out = resolve(option('--out', join(root, 'dist')));
const baseUrl = option('--base-url', process.env.ZUBRA_UI_URL ?? 'http://127.0.0.1:4174').replace(/\/$/, '');
const runtime = JSON.parse(readFileSync(join(root, 'node_modules/@zubra/runtime/package.json'), 'utf8')).version;

// Where `npx shadcn add` puts the files, from the project's root.
const TARGET = { component: (name) => `~/src/components/zubra/${name}.js`, source: (name) => `~/src/components/${name}.zb`, theme: '~/src/components/zubra/theme.css' };
const SCHEMA = { item: 'https://ui.shadcn.com/schema/registry-item.json', registry: 'https://ui.shadcn.com/schema/registry.json' };

const { components } = JSON.parse(readFileSync(join(root, 'components/index.json'), 'utf8'));
rmSync(out, { recursive: true, force: true });
for (const dir of ['modules', 'elements', 'cdn', 'r/src', 'r/element', 'r/themes', 'themes']) mkdirSync(join(out, dir), { recursive: true });
const write = (path, text) => writeFileSync(join(out, path), typeof text === 'string' ? text : `${JSON.stringify(text, null, 2)}\n`);
const title = (name) => name.split('-').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ');

// The theme: a CSS file the project imports once.
const theme = readFileSync(join(root, 'themes/default.css'), 'utf8');
cpSync(join(root, 'themes'), join(out, 'themes'), { recursive: true });
const themeItem = {
  $schema: SCHEMA.item,
  name: 'theme',
  type: 'registry:item',
  title: 'Theme',
  description: "Zubra UI's default theme: shadcn/ui's CSS variables (light, and dark with class=\"dark\"). Import it once, or keep your own shadcn theme instead.",
  files: [{ path: 'themes/default.css', type: 'registry:file', target: TARGET.theme, content: theme }],
};
write('r/theme.json', themeItem);

// Scoped themes: each one's CSS, every one together, and a registry item per theme.
const themeSets = loadThemes(join(root, 'themes/sets'));
mkdirSync(join(out, 'themes/sets'), { recursive: true });
const pendingThemeItems = [];
const themeCss = Object.fromEntries(Object.keys(themeSets).map((name) => [name, compileTheme(themeSets, name)]));
for (const [name, css] of Object.entries(themeCss)) {
  write(`themes/sets/${name}.css`, css);
  pendingThemeItems.push({
    __path: `r/themes/${name}.json`,
    $schema: SCHEMA.item,
    name: `theme-${name}`,
    type: 'registry:item',
    title: `${themeSets[name].label ?? title(name)} theme`,
    description: `${themeSets[name].description ?? ''} Scoped: add data-theme="${name}" to <html> for the whole page, or to any element for one section.`.trim(),
    files: [{ path: `themes/sets/${name}.css`, type: 'registry:file', target: `~/src/components/zubra/themes/${name}.css`, content: css }],
  });
}
for (const { __path, ...item } of pendingThemeItems) write(__path, item);
write('themes/sets/all.css', Object.values(themeCss).join('\n'));
write('themes/sets/index.json', Object.entries(themeSets).sort(([, a], [, b]) => (a.order ?? 99) - (b.order ?? 99)).map(([name, theme]) => ({ name, label: theme.label ?? title(name), description: theme.description ?? '', backdrop: theme.backdrop ?? 'dots', colorScheme: theme.colorScheme ?? 'light' })));

const items = [themeItem];
// Each component as a plain element, where --emit element covers it (it refuses shadow DOM and Zag:
// flip-card, combo-box), and a block only when all of its own components are covered too.
const plainElements = new Map();
for (const component of components) {
  const plain = compileFile(join(root, 'components', component.files[0]), { emit: 'element' });
  if (!plain.ok) continue;
  // The element as you'd write it by hand (@zubra/compiler 5.4): a class over HTMLElement. Before
  // 5.4 it was the runtime's module with `$define` inlined; the library doesn't publish that shape.
  if (!/^export class \w+ extends HTMLElement \{/m.test(plain.output) || plain.output.includes('function $define(')) {
    throw new Error(`zubra-ui: ${component.name}: @zubra/compiler wrote the pre-5.4 plain element ($define inlined). Run \`npm install\` for @zubra/compiler ^5.4.0, which writes the readable class.`);
  }
  plainElements.set(component.name, plain.output);
}
for (let dropped = true; dropped; ) {
  dropped = false;
  for (const component of components) {
    if (plainElements.has(component.name) && !(component.dependencies ?? []).every((child) => plainElements.has(child))) dropped = plainElements.delete(component.name);
  }
}
for (const component of components) {
  const file = join(root, 'components', component.files[0]);
  const compiled = compileFile(file, { emit: 'js' });
  if (!compiled.ok) throw new Error(`${component.name}: ${compiled.error}`);
  const source = readFileSync(file, 'utf8');
  write(`modules/${component.name}.js`, compiled.output);
  const dependencies = [`@zubra/runtime@^${runtime}`, ...(component.packages ?? [])];
  const common = {
    $schema: SCHEMA.item,
    name: component.name,
    type: 'registry:item',
    title: title(component.name),
    description: component.description,
    dependencies,
    categories: [component.category],
  };
  const item = {
    ...common,
    // A block brings the components it's made of (and they bring the theme).
    registryDependencies: [`${baseUrl}/r/theme.json`, ...(component.dependencies ?? []).map((child) => `${baseUrl}/r/${child}.json`)],
    files: [{ path: `components/${component.name}.js`, type: 'registry:file', target: TARGET.component(component.name), content: compiled.output }],
  };
  write(`r/${component.name}.json`, item);
  write(`r/src/${component.name}.json`, {
    ...common,
    name: `${component.name}-source`,
    title: `${title(component.name)} (.zb source)`,
    // Its imports (`./toggle-switch.zb`) need those files beside it: their source items.
    ...(component.dependencies?.length ? { registryDependencies: component.dependencies.map((child) => `${baseUrl}/r/src/${child}.json`) } : {}),
    files: [{ path: `components/${component.files[0]}`, type: 'registry:file', target: TARGET.source(component.name), content: source }],
  });
  items.push(item);
  // The same component as one plain custom element: no runtime, so no dependencies, except a
  // block's own components (as plain elements too), the theme, and the primitives for two widgets.
  const plain = plainElements.get(component.name);
  if (plain) {
    write(`elements/${component.name}.js`, plain);
    write(`cdn/${component.name}.js`, plain.replace(/(from\s*)(['"])@zubra\/runtime\/primitives\2/g, '$1$2../runtime/primitives.js$2'));
    write(`r/element/${component.name}.json`, {
      ...common,
      name: `${component.name}-element`,
      title: `${title(component.name)} (one file, no dependencies)`,
      // @zubra/runtime/primitives (rovingFocus, typeahead) is kept as an import: it needs nothing else.
      dependencies: [...(/from ['"]@zubra\/runtime\/primitives['"]/.test(plain) ? [`@zubra/runtime@^${runtime}`] : []), ...(component.packages ?? [])],
      registryDependencies: [`${baseUrl}/r/theme.json`, ...(component.dependencies ?? []).map((child) => `${baseUrl}/r/element/${child}.json`)],
      files: [{ path: `elements/${component.name}.js`, type: 'registry:file', target: TARGET.component(component.name), content: plain }],
    });
  }
}

items.push(...pendingThemeItems.map(({ __path, ...item }) => item));

// The index, in shadcn's registry.json format (items without their file contents).
write('r/registry.json', {
  $schema: SCHEMA.registry,
  name: 'zubra-ui',
  homepage: baseUrl,
  items: items.map(({ $schema, files, ...item }) => ({ ...item, files: files.map(({ content, ...rest }) => rest) })),
});
// The site (index and component pages) is scripts/site.mjs, which runs after this.
console.log(`zubra-ui: ${components.length} components (${plainElements.size} also as plain elements) → ${out} (registry at ${baseUrl}/r/)`);
