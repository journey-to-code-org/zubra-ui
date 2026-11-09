// The library site, into dist/ (after scripts/build.mjs): the home page, a page per component,
// the runtime and the components' modules for the previews, and the site's own CSS and script.
//
//   node scripts/site.mjs [--base-url https://journey-to-code-org.github.io/zubra-ui]
//
// Every link is relative, so the site works at any path (GitHub Pages serves it at /zubra-ui/).
import { compileFile } from '@zubra/compiler';
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { processFolder } from 'zubra-imager';
import { demos } from '../site/demos.js';
import { samplePhotos } from '../site/sample-photos.mjs';
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
// The theme compiler the build uses, for the themes page's editor.
cpSync(join(root, 'site/theme-compiler.js'), join(out, 'assets/theme-compiler.js'));
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

// The image-gallery demo's photos: sample scenes, through zubra-imager, as a reader would do it.
// Made in a cache (dist/ is wiped each build; unchanged photos are skipped there), then copied in.
const cache = join(root, 'node_modules/.cache/zubra-ui');
await processFolder(await samplePhotos(join(cache, 'photos')), join(cache, 'gallery'));
cpSync(join(cache, 'gallery'), join(out, 'gallery'), { recursive: true });

const sizes = {};
// The runtime as a page really loads it: the component's imports bundled and minified (the
// package's index only re-exports, so its own size would mislead). Zag's packages are left out.
const bundledSize = async (contents) => {
  const result = await build({ stdin: { contents, resolveDir: root }, bundle: true, minify: true, write: false, format: 'esm', external: ['@zag-js/*'], logLevel: 'error' });
  return gzipSync(result.outputFiles[0].contents).length;
};
const runtimeSize = await bundledSize(RUNTIME.map((entry) => `export * from '@zubra/runtime${entry === 'index' ? '' : `/${entry}`}';`).join('\n'));
for (const component of components) {
  const source = join(out, 'modules', `${component.name}.js`);
  const minified = await build({ entryPoints: [source], bundle: false, minify: true, write: false, format: 'esm', logLevel: 'error' });
  sizes[component.name] = { own: gzipSync(minified.outputFiles[0].contents).length, total: await bundledSize(`import ${JSON.stringify(source)};`) };
  // The plain element (scripts/build.mjs, --emit element), with its own components bundled in.
  const plain = join(out, 'elements', `${component.name}.js`);
  if (existsSync(plain)) sizes[component.name].plain = await bundledSize(`import ${JSON.stringify(plain)};`);
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

/** Slot descriptions from the component's doc comment (`@slot name - text`), which the manifest leaves out. */
function slotDocs(component) {
  const source = readFileSync(join(root, 'components', component.files[0]), 'utf8');
  const comment = source.match(/^<!--([\s\S]*?)-->/)?.[1] ?? '';
  return Object.fromEntries([...comment.matchAll(/@slot\s+([\w-]*)\s*-\s*(.+)/g)].map(([, name, text]) => [name, text.trim()]));
}

// ---- the page frame

const themeIndex = JSON.parse(readFileSync(join(out, 'themes/sets/index.json'), 'utf8'));
const CATEGORIES = { input: 'Form controls', widget: 'Widgets', display: 'Display', layout: 'Layout', app: 'App pieces', block: 'Blocks' };
for (const component of components) {
  if (!CATEGORIES[component.category]) throw new Error(`${component.name}: no nav section for category "${component.category}"`);
}
const STACK_KEY = 'zubra-ui:stack';
const REPO = 'https://github.com/journey-to-code-org/zubra-ui';

function frame({ prefix, title, description, current, body, scripts = [] }) {
  const nav = Object.entries(CATEGORIES).map(([category, heading]) => {
    const items = components.filter((component) => component.category === category).sort((a, b) => a.name.localeCompare(b.name));
    if (!items.length) return '';
    return `<section><h2>${heading}</h2><ul>${items.map((component) => `<li data-search="${escape(`${component.name} ${heading} ${component.description.split(/(?<=\.)\s/)[0]}`.toLowerCase())}"><a href="${prefix}components/${component.name}/"${component.name === current ? ' aria-current="page"' : ''}>${component.name}</a></li>`).join('')}</ul></section>`;
  }).join('');
  return `<!doctype html>
<html lang="en" data-stack="html" data-pm="npm">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)}</title>
  <meta name="description" content="${escape(description)}">
  <link rel="icon" href="${prefix}assets/favicon.svg" type="image/svg+xml">
  <link rel="preload" href="${prefix}assets/fonts/instrument-sans.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${prefix}themes/default.css">
  <link rel="stylesheet" href="${prefix}themes/sets/all.css">
  <link rel="stylesheet" href="${prefix}assets/site.css">
  <style id="user-theme"></style>
  <script>
    // Before paint: the remembered stack, mode and theme (per visitor, in this browser only).
    try {
      const html = document.documentElement;
      const stack = localStorage.getItem('${STACK_KEY}');
      html.dataset.stack = ${JSON.stringify(STACKS)}.includes(stack) ? stack : 'html';
      const mode = localStorage.getItem('zubra-ui:mode');
      if (mode === 'dark' || (!mode && matchMedia('(prefers-color-scheme: dark)').matches)) html.classList.add('dark');
      else if (mode === 'light') html.classList.add('light');
      const pm = localStorage.getItem('zubra-ui:pm');
      html.dataset.pm = ['npm', 'pnpm', 'yarn', 'bun'].includes(pm) ? pm : 'npm';
      const look = localStorage.getItem('zubra-ui:look');
      if (look && look !== 'zinc') html.dataset.theme = look;
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
    <nav class="site-nav" aria-label="Components">
      <div class="nav-search"><input type="search" id="nav-search" placeholder="Search  ( / )" aria-label="Search components" aria-keyshortcuts="/" autocomplete="off"><p class="nav-none" id="nav-none" role="status"></p></div>
      <a class="side-home" href="${prefix}"${current ? '' : ' aria-current="page"'}>Getting started</a>
      <a class="side-home" href="${prefix}themes/"${current === 'themes' ? ' aria-current="page"' : ''}>Themes</a>
      ${nav}
    </nav>
    <main id="main" tabindex="-1">
${body}
    </main>
  </div>
  <modal-dialog id="theme" label="Theme">
    <span slot="heading">Theme</span>
    <p class="hint">Every component reads shadcn/ui's CSS variables, so any shadcn theme works. Pick a look or a colour, or paste a theme's CSS.</p>
    <p class="dialog-label" id="look-label">Look: colours, fonts, corners and motion</p>
    <segmented-control id="look" label="Look" aria-labelledby="look-label"></segmented-control>
    <p class="dialog-label" id="preset-label">Accent colour</p>
    <segmented-control id="preset" label="Accent colour" aria-labelledby="preset-label"></segmented-control>
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
    start(${JSON.stringify({ stacks: STACKS.map((value) => ({ value, label: STACK_NAMES[value] })), stackKey: STACK_KEY, looks: themeIndex.map(({ name, label }) => ({ value: name, label })) })});
  </script>
${scripts.join('\n')}
</body>
</html>
`;
}

// ---- code blocks: one per stack, shown by the stack switch (html[data-stack])

const language = { html: 'html', react: 'html', vue: 'html', svelte: 'html', angular: 'js' };
const file = { html: 'index.html', react: 'Example.jsx', vue: 'Example.vue', svelte: 'Example.svelte', angular: 'example.component.ts' };
// shadcn's CLI through each package manager: an install command shows the visitor's choice.
const RUNNERS = { npm: 'npx', pnpm: 'pnpm dlx', yarn: 'yarn dlx', bun: 'bunx --bun' };
function code(text, lang, label) {
  if (lang === 'sh' && text.startsWith('npx shadcn@latest ')) {
    const tabs = Object.keys(RUNNERS).map((pm) => `<button type="button" class="pm-tab" data-pm-tab="${pm}">${pm}</button>`).join('');
    const variants = Object.entries(RUNNERS).map(([pm, runner]) => `<code class="pm-only" data-pm="${pm}">${highlight(text.replace(/^npx /, `${runner} `), lang)}</code>`).join('');
    return `<div class="code"><div class="code-head"><span class="pm-tabs" role="group" aria-label="Package manager">${tabs}</span><button type="button" class="copy" data-copy>Copy</button></div><pre tabindex="0">${variants}</pre></div>`;
  }
  return `<div class="code"><div class="code-head"><span>${escape(label)}</span><button type="button" class="copy" data-copy>Copy</button></div><pre tabindex="0"><code>${highlight(text, lang)}</code></pre></div>`;
}
const stackCode = (name, demo) => STACKS.map((stack) => `<div class="stack-only" data-stack="${stack}">${code(snippets[stack](name, demo), language[stack], file[stack])}</div>`).join('');

// ---- the preview: the element as the HTML snippet writes it, with its props set by a module script

function preview(name, demo) {
  // previewAttrs: what the live preview needs that the snippets shouldn't show (a path from this page).
  const attributes = Object.entries({ ...demo.attrs, ...demo.previewAttrs }).map(([attribute, value]) => ` ${attribute}="${escape(value)}"`).join('');
  const opener = demo.opener ? `<button type="button" class="button" data-open="${name}">${escape(demo.opener)}</button>`
    : demo.trigger ? `<button type="button" class="button" data-trigger="${name}">${escape(demo.trigger.label)}</button>` : '';
  return `<div class="stage" data-preview="${name}">${opener}<${name}${attributes}>${demo.html ?? ''}</${name}></div>
      <p class="event" data-events="${name}" aria-live="polite">${demo.events?.length ? `Try it: events appear here (${demo.events.map((event) => `<code>${event}</code>`).join(', ')}).` : 'This one has no events: it shows what it\'s given.'}</p>`;
}
function previewScript(prefix, name, demo) {
  return `  <script type="module">
    import '${prefix}preview/${name}.js';
    import { wire } from '${prefix}assets/site.js';
    wire(${JSON.stringify(name)}, ${JSON.stringify({ props: demo.props ?? {}, events: demo.events ?? [], opener: Boolean(demo.opener), trigger: demo.trigger ?? null })});
  </script>`;
}

// ---- component pages

const installs = (name) => [
  ['Compiled (any project)', `npx shadcn@latest add ${baseUrl}/r/${name}.json`],
  ...(sizes[name].plain ? [[`One file, no dependencies (${kb(sizes[name].plain)} gzipped)`, `npx shadcn@latest add ${baseUrl}/r/element/${name}.json`]] : []),
  ['.zb source (to edit it with Zubra)', `npx shadcn@latest add ${baseUrl}/r/src/${name}.json`],
];

for (const component of components) {
  const { name } = component;
  const demo = demos[name];
  const { props, events, slots } = api(component);
  const prefix = '../../';
  const propRows = props.map((prop) => {
    // Arrays and objects are set as properties; their item shape comes from the demo.
    const sample = demo.props?.[prop.name];
    const structured = Array.isArray(sample) || (sample && typeof sample === 'object');
    const type = Array.isArray(sample) && sample[0] && typeof sample[0] === 'object' ? `{ ${Object.keys(sample[0]).join(', ')} }[]`
      : sample && typeof sample === 'object' && !Array.isArray(sample) ? `{ ${Object.keys(sample).join(', ')} }` : prop.type?.text ?? '';
    const attribute = structured ? '<span class="none">property only</span>'
      : prop.attribute && prop.attribute !== prop.name ? `attribute <code>${escape(prop.attribute)}</code>` : prop.attribute ? '' : '<span class="none">property only</span>';
    return `<tr id="prop-${escape(prop.name)}"><td><code>${escape(prop.name)}</code>${attribute ? `<br><small>${attribute}</small>` : ''}</td><td><code>${escape(type)}</code></td><td><code>${escape(prop.default ?? '')}</code></td></tr>`;
  }).join('');
  const eventRows = events.map((event) => `<tr id="event-${escape(event.name)}"><td><code>${escape(event.name)}</code></td><td>${prose(event.description ?? '')}</td></tr>`).join('');
  const slotRows = slots.map((slot) => `<tr id="slot-${escape(slot.name || 'default')}"><td><code>${escape(slot.name || '(default)')}</code></td><td>${prose(slot.description ?? slotDocs(component)[slot.name] ?? '')}</td></tr>`).join('');
  const body = `      <article class="component">
        <h1>${escape(name)}</h1>
        <p class="lead">${prose(component.description)}</p>
        ${preview(name, demo)}
        ${demo.variants ? `<p class="variants-label">${escape(demo.variants.label)}</p><div class="variants" data-variants="${name}">${demo.variants.html}</div>` : ''}
        <p class="source">Source: <a href="${REPO}/blob/master/components/${component.files[0]}"><code>${component.files[0]}</code></a>, and its <a href="${prefix}r/${name}.json">registry item</a>.</p>
        <h2 id="install">Install</h2>
        ${installs(name).map(([label, command]) => `<div class="install"><span>${escape(label)}</span>${code(command, 'sh', 'Terminal')}</div>`).join('')}
        ${sizes[name].plain ? `<div class="install"><span>No build: a script tag, straight from this site</span>${code(`<link rel="stylesheet" href="${baseUrl}/themes/default.css">\n<script type="module" src="${baseUrl}/cdn/${name}.js"></script>`, 'html', 'HTML')}</div>` : ''}
        <p class="note">The compiled install writes <code>src/components/zubra/${name}.js</code> and the theme, and adds <code>@zubra/runtime</code> to your dependencies${component.packages?.length ? `, with ${component.packages.map((pkg) => `<code>${pkg}</code>`).join(' and ')} (Zag.js runs its keyboard and focus behaviour)` : ''}.${sizes[name].plain ? ` The one-file install writes the same path as a plain custom element that needs nothing installed ${component.dependencies?.length ? `, with the plain elements of the components it's made of` : ` (or <a href="${prefix}elements/${name}.js" download>download it</a> and load it with a <code>&lt;script type="module"&gt;</code>)`}; it's smaller on a page with one to three components, the shared runtime with more.` : ''}</p>
        <h2 id="usage">Usage</h2>
        ${stackCode(name, demo)}
        <h2 id="api">API</h2>
        ${propRows ? `<div class="table"><table><caption>Properties <small>(each is also an HTML attribute of the same name, unless marked)</small></caption><thead><tr><th scope="col">Property</th><th scope="col">Type</th><th scope="col">Default</th></tr></thead><tbody>${propRows}</tbody></table></div>` : ''}
        ${eventRows ? `<div class="table"><table><caption>Events</caption><thead><tr><th scope="col">Event</th><th scope="col">When</th></tr></thead><tbody>${eventRows}</tbody></table></div>` : ''}
        ${slotRows ? `<div class="table"><table><caption>Slots</caption><thead><tr><th scope="col">Slot</th><th scope="col">For</th></tr></thead><tbody>${slotRows}</tbody></table></div>` : ''}
        <h2 id="size">Size</h2>
        <p><strong>${kb(sizes[name].own)}</strong> gzipped for the component, plus the runtime, which every Zubra component on a page shares (up to <strong>${kb(runtimeSize)}</strong>, all of it). On its own, with the parts of the runtime it uses, it's ${kb(sizes[name].total)}${component.packages?.length ? `, plus ${component.packages.join(' and ')}` : ''}.</p>
      </article>`;
  write(`components/${name}/index.html`, frame({ prefix, title: `${name} · Zubra UI`, description: component.description, current: name, body, scripts: [previewScript(prefix, name, demo)] }));
}

// ---- the themes page: the same small app in every theme, then an editor for your own

const LOOK_COMPONENTS = ['backdrop-pattern', 'content-card', 'text-field', 'toggle-switch', 'action-button', 'status-badge', 'alert-banner', 'user-avatar', 'check-box'];
const lookApp = (label) => `<div class="look-grid">
              <content-card heading="The weekly digest">
                <p>One email on Monday: what changed, what's next, and nothing else.</p>
                <text-field label="Email" type="email" placeholder="you@example.com" autocomplete="off" required></text-field>
                <toggle-switch label="Include the changelog" description="A short list, at the end."></toggle-switch>
                <span slot="footer"><action-button>Subscribe</action-button> <action-button variant="ghost">Not now</action-button></span>
              </content-card>
              <div class="look-side">
                <alert-banner variant="success" heading="${escape(label)} is on">Every component inside this section reads its colours, corners, fonts and motion.</alert-banner>
                <div class="look-people">
                  <user-avatar name="Ada Lovelace" status="online"></user-avatar>
                  <user-avatar name="Grace Hopper" status="away"></user-avatar>
                  <user-avatar name="Alan Turing"></user-avatar>
                  <status-badge variant="success" dot>2 online</status-badge>
                </div>
                <check-box label="Remember this device" description="For 30 days."></check-box>
              </div>
            </div>`;
const themesBody = `      <section class="themes-page">
        <h1>Themes</h1>
        <p class="lead">A theme is more than a colour. Each one sets the colours for light and dark, the fonts, the corners and how things move, and it applies wherever you put <code>data-theme</code>: on <code>&lt;html&gt;</code> for the whole page, or on any element for one part of it. Here is the same small app in each.</p>
        ${code('<html data-theme="paper">        <!-- the whole page -->\n<section data-theme="terminal">  <!-- or one part of it -->', 'html', 'HTML')}
${themeIndex.map((theme) => `        <section class="look" data-theme="${theme.name}" aria-labelledby="look-${theme.name}">
          <backdrop-pattern pattern="${theme.backdrop}" animated>
            <div class="look-inner">
              <div class="look-head"><h2 id="look-${theme.name}">${escape(theme.label)}</h2><status-badge variant="outline">${theme.colorScheme === 'dark' ? 'dark first' : 'light first'}</status-badge></div>
              <p class="look-description">${escape(theme.description)}</p>
              ${lookApp(theme.label)}
            </div>
          </backdrop-pattern>
          <div class="install look-install"><span>Add the ${escape(theme.label)} theme</span>${code(`npx shadcn@latest add ${baseUrl}/r/themes/${theme.name}.json`, 'sh', 'Terminal')}</div>
        </section>`).join('\n')}
        <h2 id="make">Make your own</h2>
        <p>Start from a theme, change what you like, and copy the result. The accent applies in light and dark; the page and text colours are the light ones, and dark keeps the starting theme's. Copy the JSON to keep in <code>themes/sets/</code> (it compiles with the rest), or the CSS to use as it is.</p>
        <form class="editor" id="editor">
          <select-field id="editor-base" label="Start from" name="base"></select-field>
          <label class="editor-colour">Accent, light and dark <input type="color" id="editor-primary" name="primary" value="#7c3aed"></label>
          <label class="editor-colour">Page, in light <input type="color" id="editor-background" name="background" value="#ffffff"></label>
          <label class="editor-colour">Text, in light <input type="color" id="editor-foreground" name="foreground" value="#18181b"></label>
          <label class="editor-range">Corners <input type="range" id="editor-radius" name="radius" min="0" max="1.5" step="0.05" value="0.6"> <output id="editor-radius-out">0.6rem</output></label>
          <select-field id="editor-font" label="Font" name="font"></select-field>
          <radio-group id="editor-motion" label="Motion" name="motion" orientation="horizontal"></radio-group>
        </form>
        <section class="look" data-theme="custom" aria-labelledby="look-custom">
          <backdrop-pattern pattern="mesh">
            <div class="look-inner">
              <div class="look-head"><h2 id="look-custom">Yours</h2><status-badge variant="outline">live</status-badge></div>
              ${lookApp('Your theme')}
            </div>
          </backdrop-pattern>
        </section>
        <style id="custom-theme"></style>
        <p id="editor-status" class="hint" role="status"></p>
        <div class="editor-out">
          <div class="code"><div class="code-head"><span>themes/sets/custom.json</span><button type="button" class="copy" data-copy>Copy</button></div><pre tabindex="0"><code id="editor-json"></code></pre></div>
          <div class="code"><div class="code-head"><span>custom.css</span><button type="button" class="copy" data-copy>Copy</button></div><pre tabindex="0"><code id="editor-css"></code></pre></div>
        </div>
      </section>`;
write('themes/index.html', frame({
  prefix: '../',
  title: 'Themes · Zubra UI',
  description: 'Scoped themes for Zubra UI: colours, fonts, corners and motion, on the whole page or one section.',
  current: 'themes',
  body: themesBody,
  scripts: [`  <script type="module">
${[...LOOK_COMPONENTS, 'select-field', 'radio-group'].map((name) => `    import '../preview/${name}.js';`).join('\n')}
    import { startEditor } from '../assets/themes.js';
    startEditor();
  </script>`],
}));

// ---- the home page: live components first, then how to install, then the list

const showcase = ['toggle-switch', 'segmented-control', 'star-rating', 'progress-ring', 'quantity-stepper', 'tag-input'];
const homeBody = `      <section class="home">
        <h1>Web components you copy in and own.</h1>
        <p class="lead">Ready-made pieces for websites: switches, star ratings, date pickers, pop-up dialogs and more. They work on any site, in plain HTML or with React, Vue, Svelte or Angular. Copy one in, and it's yours to change.</p>
        <p class="cta"><a class="button primary" href="#start">Get started</a><a class="button" href="#all">Browse all ${components.length} components</a></p>
        <div class="showcase">
          ${showcase.map((name) => `<div class="tile"><a class="tile-name" href="components/${name}/">${name}</a>${preview(name, demos[name])}</div>`).join('\n          ')}
        </div>
        <h2 id="themes">Themes with character</h2>
        <p>Colours, fonts, corners and motion, for a whole page or one section: put <code>data-theme</code> where you want it. <a href="themes/">See all five on the same app, or make your own</a>.</p>
        <div class="theme-strip">
          ${themeIndex.map((theme) => `<a class="theme-chip" data-theme="${theme.name}" href="themes/#look-${theme.name}"><strong>${escape(theme.label)}</strong><span class="theme-swatches" aria-hidden="true"><span style="background: var(--primary)"></span><span style="background: var(--secondary)"></span><span style="background: var(--chart-1)"></span><span style="background: var(--chart-2)"></span></span><small>${escape(theme.description.split(':')[0])}</small></a>`).join('\n          ')}
        </div>
        <h2 id="start">Start</h2>
        <ol class="steps">
          <li><p>Add a component. No setup first: no <code>components.json</code>, no Tailwind, no framework.</p>${code(`npx shadcn@latest add ${baseUrl}/r/toggle-switch.json`, 'sh', 'Terminal')}</li>
          <li><p>Import it and the theme once, then use the tag.</p>${stackCode('toggle-switch', demos['toggle-switch'])}</li>
          <li><p>Change it. The file is yours. For the readable source, add <code>/r/src/toggle-switch.json</code> instead and edit the <code>.zb</code> file with <a href="https://github.com/journey-to-code-org/zubra">Zubra</a>.</p></li>
        </ol>
        <h2 id="shadcn">Already on shadcn/ui?</h2>
        <p>The components use your theme as it is: <code>--primary</code>, <code>--border</code>, <code>--muted-foreground</code>, <code>--radius</code> and the rest. Skip the theme file, and they match your app.</p>
        <h2 id="all">All ${components.length} components</h2>
        <p>Every one at once (shadcn takes several items in one command):</p>
        ${code(`npx shadcn@latest add ${components.map(({ name }) => `${baseUrl}/r/${name}.json`).join(' ')}`, 'sh', 'Terminal')}
        <p class="note">The registry's index is <a href="r/registry.json"><code>r/registry.json</code></a>, and <a href="llms.txt"><code>llms.txt</code></a> describes every component for AI tools.</p>
        <ul class="all">${[...components].sort((a, b) => a.name.localeCompare(b.name)).map((component) => `<li><a href="components/${component.name}/">${component.name}</a><span>${prose(component.description.split(/(?<=\.)\s/)[0])}</span></li>`).join('')}</ul>
      </section>`;
write('index.html', frame({
  prefix: './',
  title: 'Zubra UI: web components you copy in and own',
  description: 'Accessible web components for any project, installed with the shadcn CLI and themed with shadcn/ui\'s variables.',
  current: null,
  body: homeBody,
  scripts: showcase.map((name) => previewScript('./', name, demos[name])),
}));
// llms.txt: what each component is and how to use it, for AI tools (https://llmstxt.org).
write('llms.txt', [
  '# Zubra UI',
  '',
  "> Copy-in web components for any project (plain HTML, React, Vue, Svelte, Angular). Install one with the shadcn CLI; they're themed with shadcn/ui's CSS variables and share `@zubra/runtime` (at most " + kb(runtimeSize) + ' gzipped).',
  '',
  `Install: \`npx shadcn@latest add ${baseUrl}/r/<name>.json\` writes \`src/components/zubra/<name>.js\` and the theme. Import the file, then use the tag. Set arrays and objects as properties; listen for the events.`,
  '',
  '## Components',
  '',
  ...components.map((component) => {
    const { props, events } = api(component);
    const list = (items) => items.map((item) => item.name).join(', ') || 'none';
    return `- [${component.name}](${baseUrl}/components/${component.name}/): ${component.description} Properties: ${list(props)}. Events: ${list(events)}.`;
  }),
  '',
].join('\n'));
console.log(`site: ${components.length} component pages and the home page in ${out}`);
