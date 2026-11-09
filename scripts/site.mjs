// The library site, into dist/ (after scripts/build.mjs): the home page, a page per component,
// the runtime and the components' modules for the previews, and the site's own CSS and script.
//
//   node scripts/site.mjs [--base-url https://journey-to-code-org.github.io/zubra-ui]
//
// Every link is relative, so the site works at any path (GitHub Pages serves it at /zubra-ui/).
import { compileFile } from '@zubra/compiler';
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { demos } from '../site/demos.js';
import { highlight } from '../site/highlight.js';
import { STACKS, STACK_NAMES, snippets } from '../site/snippets.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const baseUrl = option('--base-url', process.env.ZUBRA_UI_URL ?? 'http://127.0.0.1:4174').replace(/\/$/, '');
const { components } = JSON.parse(readFileSync(join(root, 'components/index.json'), 'utf8'));
const runtimeDir = join(root, 'node_modules/@zubra/runtime/dist/production');
const missing = components.filter((component) => !demos[component.name]).map((component) => component.name);
if (missing.length) throw new Error(`site: no demo for ${missing.join(', ')} (site/demos.js)`);

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Prose from the manifest: `code` spans become <code>.
const prose = (text) => escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');
const write = (path, text) => {
  mkdirSync(dirname(join(out, path)), { recursive: true });
  writeFileSync(join(out, path), text);
};

// ---- assets: the runtime, the previews' modules (Zag bundled into the ones that use it), the site's own CSS and JS

cpSync(runtimeDir, join(out, 'runtime'), { recursive: true });
cpSync(join(root, 'site/assets'), join(out, 'assets'), { recursive: true });
// The fonts, self-hosted (no third-party request): Instrument Sans (variable) and JetBrains Mono.
const fonts = { 'instrument-sans.woff2': '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2',
  'jetbrains-mono-400.woff2': '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
  'jetbrains-mono-600.woff2': '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2' };
mkdirSync(join(out, 'assets/fonts'), { recursive: true });
for (const [name, path] of Object.entries(fonts)) cpSync(join(root, 'node_modules', path), join(out, 'assets/fonts', name));
// Zag's runtime half, as one shared module the import map points at; each component bundles its own machine.
await build({ stdin: { contents: "export * from '@zag-js/vanilla';", resolveDir: root }, bundle: true, format: 'esm', minify: true, outfile: join(out, 'vendor/zag-vanilla.js'), logLevel: 'error' });
const RUNTIME = ['index', 'primitives', 'spread', 'signal', 'effect', 'zag'];
const importMap = (prefix) => JSON.stringify({
  imports: {
    ...Object.fromEntries(RUNTIME.map((entry) => [entry === 'index' ? '@zubra/runtime' : `@zubra/runtime/${entry}`, `${prefix}runtime/${entry}.js`])),
    '@zag-js/vanilla': `${prefix}vendor/zag-vanilla.js`,
  },
});

const sizes = {};
const runtimeSize = gzipSync(readFileSync(join(runtimeDir, 'index.js'))).length;
for (const component of components) {
  const source = join(out, 'modules', `${component.name}.js`);
  const minified = await build({ entryPoints: [source], bundle: false, minify: true, write: false, format: 'esm', logLevel: 'error' });
  sizes[component.name] = gzipSync(minified.outputFiles[0].contents).length;
  if (component.packages?.length) {
    // The previews can't resolve npm packages: bundle them in, keeping the runtime shared.
    await build({
      entryPoints: [source], bundle: true, format: 'esm', minify: true, outfile: join(out, 'preview', `${component.name}.js`), logLevel: 'error',
      // The runtime (with its Zag adapter) stays shared, through the import map: bundling the adapter
      // would give the component its own copy of the runtime.
      external: ['@zubra/runtime', '@zag-js/vanilla', ...RUNTIME.filter((entry) => entry !== 'index').map((entry) => `@zubra/runtime/${entry}`)],
      nodePaths: [join(root, 'node_modules')],
    });
  } else {
    cpSync(source, join(out, 'preview', `${component.name}.js`));
  }
}
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

// ---- the interface (props, attributes, events, slots) from the compiler's manifest

function api(component) {
  const result = compileFile(join(root, 'components', component.files[0]), { emit: 'manifest' });
  const declaration = JSON.parse(result.output).modules[0].declarations[0];
  const attributes = declaration.attributes ?? [];
  const props = (declaration.members ?? []).filter((member) => member.kind === 'field' && !member.static && member.privacy !== 'private')
    .map((member) => ({ ...member, attribute: attributes.find((attribute) => attribute.fieldName === member.name)?.name }));
  return { props, events: declaration.events ?? [], slots: declaration.slots ?? [], parts: declaration.cssParts ?? [] };
}

// ---- the page frame

const CATEGORIES = { input: 'Form controls', widget: 'Widgets', chart: 'Charts', app: 'App pieces' };
const STACK_KEY = 'zubra-ui:stack';

function frame({ prefix, title, description, current, body, scripts = [] }) {
  const nav = Object.entries(CATEGORIES).map(([category, heading]) => {
    const items = components.filter((component) => component.category === category);
    if (!items.length) return '';
    return `<section><h2>${heading}</h2><ul>${items.map((component) => `<li><a href="${prefix}components/${component.name}/"${component.name === current ? ' aria-current="page"' : ''}>${component.name}</a></li>`).join('')}</ul></section>`;
  }).join('');
  return `<!doctype html>
<html lang="en" data-stack="html">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="${prefix}assets/fonts/instrument-sans.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${prefix}themes/default.css">
  <link rel="stylesheet" href="${prefix}assets/site.css">
  <style id="user-theme"></style>
  <script>
    // Before paint: the remembered stack, mode and theme (per visitor, in this browser only).
    try {
      const html = document.documentElement;
      html.dataset.stack = localStorage.getItem('${STACK_KEY}') || 'html';
      if (localStorage.getItem('zubra-ui:mode') === 'dark' || (!localStorage.getItem('zubra-ui:mode') && matchMedia('(prefers-color-scheme: dark)').matches)) html.classList.add('dark');
      const preset = localStorage.getItem('zubra-ui:preset');
      if (preset && preset !== 'zinc') html.classList.add('theme-' + preset);
      document.getElementById('user-theme').textContent = localStorage.getItem('zubra-ui:theme') || '';
    } catch {}
  </script>
  <script type="importmap">${importMap(prefix)}</script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="bar">
    <a class="brand" href="${prefix}" aria-label="Zubra UI home">
      <svg class="mark" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><path fill="currentColor" d="M10 15 a5 5 0 0 1 5 -5 H81 a5 5 0 0 1 5 5 V27 H10 Z"/><path fill="currentColor" d="M10 69 H86 V81 a5 5 0 0 1 -5 5 H15 a5 5 0 0 1 -5 -5 Z"/><path class="mark-accent" d="M54 27 H86 L42 69 H10 Z"/></svg>
      <span>Zubra UI</span>
    </a>
    <div class="stack-switch">
      <span id="stack-label">Code for</span>
      <segmented-control id="stack" label="Code for" aria-labelledby="stack-label"></segmented-control>
    </div>
    <div class="bar-tools">
      <button type="button" class="tool" id="theme-open" aria-haspopup="dialog">Theme</button>
      <button type="button" class="tool" id="mode" aria-pressed="false">Dark</button>
      <a class="tool" href="https://github.com/journey-to-code-org/zubra-ui">GitHub</a>
    </div>
  </header>
  <div class="layout">
    <nav class="side" aria-label="Components">
      <a class="side-home" href="${prefix}"${current ? '' : ' aria-current="page"'}>Getting started</a>
      ${nav}
    </nav>
    <main id="main" tabindex="-1">
${body}
    </main>
  </div>
  <modal-dialog id="theme" label="Theme">
    <span slot="heading">Theme</span>
    <p class="hint">Every component reads shadcn/ui's CSS variables, so any shadcn theme works. Pick a colour, or paste a theme's CSS.</p>
    <segmented-control id="preset" label="Colour"></segmented-control>
    <label class="paste-label" for="paste">Paste a shadcn theme (the <code>:root</code> and <code>.dark</code> blocks)</label>
    <textarea id="paste" rows="7" spellcheck="false" placeholder=":root {&#10;  --primary: oklch(0.546 0.245 262.881);&#10;  ...&#10;}"></textarea>
    <p class="hint" id="paste-status" role="status"></p>
    <div slot="actions" class="actions">
      <button type="button" class="button" id="theme-reset">Reset</button>
      <button type="button" class="button primary" id="theme-apply">Apply theme</button>
    </div>
  </modal-dialog>
  <script type="module">
    import '${prefix}preview/segmented-control.js';
    import '${prefix}preview/modal-dialog.js';
    import { start } from '${prefix}assets/site.js';
    start(${JSON.stringify({ stacks: STACKS.map((value) => ({ value, label: STACK_NAMES[value] })), stackKey: STACK_KEY })});
  </script>
${scripts.join('\n')}
</body>
</html>
`;
}

// ---- code blocks: one per stack, shown by the stack switch (html[data-stack])

const language = { html: 'html', react: 'html', vue: 'html', svelte: 'html', angular: 'js' };
const file = { html: 'index.html', react: 'Example.jsx', vue: 'Example.vue', svelte: 'Example.svelte', angular: 'example.component.ts' };
function code(text, lang, label) {
  return `<div class="code"><div class="code-head"><span>${escape(label)}</span><button type="button" class="copy" data-copy>Copy</button></div><pre><code>${highlight(text, lang)}</code></pre></div>`;
}
const stackCode = (name, demo) => STACKS.map((stack) => `<div class="stack-only" data-stack="${stack}">${code(snippets[stack](name, demo), language[stack], file[stack])}</div>`).join('');

// ---- the preview: the element as the HTML snippet writes it, with its props set by a module script

function preview(name, demo) {
  const attributes = Object.entries(demo.attrs ?? {}).map(([attribute, value]) => ` ${attribute}="${escape(value)}"`).join('');
  const opener = demo.opener ? `<button type="button" class="button" data-open="${name}">${escape(demo.opener)}</button>` : '';
  return `<div class="stage" data-preview="${name}">${opener}<${name}${attributes}>${demo.html ?? ''}</${name}></div>
      <p class="event" data-events="${name}" aria-live="polite">${demo.events?.length ? `Try it: events appear here (${demo.events.map((event) => `<code>${event}</code>`).join(', ')}).` : 'This one has no events: it shows what it\'s given.'}</p>`;
}
function previewScript(prefix, name, demo) {
  return `  <script type="module">
    import '${prefix}preview/${name}.js';
    import { wire } from '${prefix}assets/site.js';
    wire(${JSON.stringify(name)}, ${JSON.stringify({ props: demo.props ?? {}, events: demo.events ?? [], opener: Boolean(demo.opener) })});
  </script>`;
}

// ---- component pages

const installs = (name) => [
  ['Compiled (any project)', `npx shadcn@latest add ${baseUrl}/r/${name}.json`],
  ['.zb source (to edit it with Zubra)', `npx shadcn@latest add ${baseUrl}/r/src/${name}.json`],
];

for (const component of components) {
  const { name } = component;
  const demo = demos[name];
  const { props, events, slots } = api(component);
  const prefix = '../../';
  const propRows = props.map((prop) => `<tr><td><code>${escape(prop.name)}</code></td><td>${prop.attribute ? `<code>${escape(prop.attribute)}</code>` : '<span class="none">property only</span>'}</td><td><code>${escape(prop.type?.text ?? '')}</code></td><td><code>${escape(prop.default ?? '')}</code></td></tr>`).join('');
  const eventRows = events.map((event) => `<tr><td><code>${escape(event.name)}</code></td><td>${prose(event.description ?? '')}</td></tr>`).join('');
  const slotRows = slots.map((slot) => `<tr><td><code>${escape(slot.name || '(default)')}</code></td><td>${prose(slot.description ?? '')}</td></tr>`).join('');
  const body = `      <article class="component">
        <h1>${escape(name)}</h1>
        <p class="lead">${prose(component.description)}</p>
        ${preview(name, demo)}
        <h2 id="install">Install</h2>
        ${installs(name).map(([label, command]) => `<div class="install"><span>${escape(label)}</span>${code(command, 'sh', 'Terminal')}</div>`).join('')}
        <p class="note">The compiled install writes <code>src/components/zubra/${name}.js</code> and the theme, and adds <code>@zubra/runtime</code> to your dependencies${component.packages?.length ? `, with ${component.packages.map((pkg) => `<code>${pkg}</code>`).join(' and ')}` : ''}.</p>
        <h2 id="usage">Usage</h2>
        ${stackCode(name, demo)}
        <h2 id="api">API</h2>
        ${propRows ? `<div class="table"><table><caption>Properties</caption><thead><tr><th scope="col">Property</th><th scope="col">Attribute</th><th scope="col">Type</th><th scope="col">Default</th></tr></thead><tbody>${propRows}</tbody></table></div>` : ''}
        ${eventRows ? `<div class="table"><table><caption>Events</caption><thead><tr><th scope="col">Event</th><th scope="col">When</th></tr></thead><tbody>${eventRows}</tbody></table></div>` : ''}
        ${slotRows ? `<div class="table"><table><caption>Slots</caption><thead><tr><th scope="col">Slot</th><th scope="col">For</th></tr></thead><tbody>${slotRows}</tbody></table></div>` : ''}
        <h2 id="size">Size</h2>
        <p><strong>${kb(sizes[name])}</strong> gzipped${component.packages?.length ? `, plus ${component.packages.join(' and ')}` : ''}, and the runtime once per page (${kb(runtimeSize)}, shared by every component).</p>
      </article>`;
  write(`components/${name}/index.html`, frame({ prefix, title: `${name} · Zubra UI`, description: component.description, current: name, body, scripts: [previewScript(prefix, name, demo)] }));
}

// ---- the home page: live components first, then how to install, then the list

const showcase = ['toggle-switch', 'segmented-control', 'star-rating', 'progress-ring', 'quantity-stepper', 'tag-input'];
const homeBody = `      <section class="home">
        <h1>Web components you copy in and own.</h1>
        <p class="lead">Accessible components for any project: plain HTML, React, Vue, Svelte or Angular. Install them with the shadcn CLI, theme them with shadcn's variables, and read every line.</p>
        <div class="showcase">
          ${showcase.map((name) => `<div class="tile"><a class="tile-name" href="components/${name}/">${name}</a>${preview(name, demos[name])}</div>`).join('\n          ')}
        </div>
        <h2>Start</h2>
        <ol class="steps">
          <li><p>Add a component. No setup first: no <code>components.json</code>, no Tailwind, no framework.</p>${code(`npx shadcn@latest add ${baseUrl}/r/toggle-switch.json`, 'sh', 'Terminal')}</li>
          <li><p>Import it and the theme once, then use the tag.</p>${stackCode('toggle-switch', demos['toggle-switch'])}</li>
          <li><p>Change it. The file is yours. For the readable source, add <code>/r/src/toggle-switch.json</code> instead and edit the <code>.zb</code> file with <a href="https://github.com/journey-to-code-org/zubra">Zubra</a>.</p></li>
        </ol>
        <h2>Already on shadcn/ui?</h2>
        <p>The components use your theme as it is: <code>--primary</code>, <code>--border</code>, <code>--muted-foreground</code>, <code>--radius</code> and the rest. Skip the theme file, and they match your app.</p>
        <h2>All ${components.length} components</h2>
        <ul class="all">${components.map((component) => `<li><a href="components/${component.name}/">${component.name}</a><span>${prose(component.description.split(/(?<=\.)\s/)[0])}</span></li>`).join('')}</ul>
      </section>`;
write('index.html', frame({
  prefix: './',
  title: 'Zubra UI: web components you copy in and own',
  description: 'Accessible web components for any project, installed with the shadcn CLI and themed with shadcn/ui\'s variables.',
  current: null,
  body: homeBody,
  scripts: showcase.map((name) => previewScript('./', name, demos[name])),
}));
console.log(`site: ${components.length} component pages and the home page in ${out}`);
