// Builds Zubra UI into dist/:
//
//   dist/modules/<name>.js      each component compiled to a standard ES module (it imports @zubra/runtime)
//   dist/r/<name>.json          a shadcn registry item: `npx shadcn add <site>/r/<name>.json`
//   dist/r/src/<name>.json      the same component as .zb source, for Zubra projects
//   dist/r/theme.json           the default theme (shadcn/ui's variables) as a CSS file
//   dist/r/registry.json        the registry's index, in shadcn's registry.json format
//   dist/themes/*.css           the themes, for a <link>
//
//   node scripts/build.mjs [--base-url https://example.github.io/wcl] [--out dist]
//
// --base-url is where dist/ will be served: registry items name their dependencies (the theme, other
// components) by URL. It defaults to $ZUBRA_UI_URL, then http://127.0.0.1:4174 (scripts/serve.mjs).
import { compileFile } from '@zubra/compiler';
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
for (const dir of ['modules', 'r/src', 'themes']) mkdirSync(join(out, dir), { recursive: true });
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

const items = [themeItem];
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
    registryDependencies: [`${baseUrl}/r/theme.json`],
    files: [{ path: `components/${component.name}.js`, type: 'registry:file', target: TARGET.component(component.name), content: compiled.output }],
  };
  write(`r/${component.name}.json`, item);
  write(`r/src/${component.name}.json`, {
    ...common,
    name: `${component.name}-source`,
    title: `${title(component.name)} (.zb source)`,
    files: [{ path: `components/${component.files[0]}`, type: 'registry:file', target: TARGET.source(component.name), content: source }],
  });
  items.push(item);
}

// The index, in shadcn's registry.json format (items without their file contents).
write('r/registry.json', {
  $schema: SCHEMA.registry,
  name: 'zubra-ui',
  homepage: baseUrl,
  items: items.map(({ $schema, files, ...item }) => ({ ...item, files: files.map(({ content, ...rest }) => rest) })),
});
// The site (index and component pages) is scripts/site.mjs, which runs after this.
console.log(`zubra-ui: ${components.length} components → ${out} (registry at ${baseUrl}/r/)`);
