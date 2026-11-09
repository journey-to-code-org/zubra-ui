// The page composer. A page is a list of items, each a component with its attributes, its
// properties, its slotted HTML and a width (full, half or a third of a row). It's drawn into the
// canvas with the real components, kept in this browser, shared as a link (#page=…), and written
// out as a page that runs as it is (script tags from the site), React, Vue, or install commands.

import { compileTheme, resolveTheme } from './theme-compiler.js';

const STORE = 'zubra-ui:composer';
const store = { get: (key) => { try { return localStorage.getItem(key); } catch { return null; } }, set: (key, value) => { try { localStorage.setItem(key, value); } catch {} } };
const WIDTHS = { full: 'Full width', half: 'Half', third: 'A third' };
const VIEWPORTS = { desktop: '100%', tablet: '48rem', phone: '24rem' };
const TEMPLATES = {
  landing: { label: 'A landing page', items: [{ name: 'nav-bar', html: '<action-button slot="actions" variant="outline">Sign in</action-button>' }, { name: 'hero-section', html: 'Small classes, real ovens, and a starter to take home. Weekends in Portland and online.\n<action-button slot="actions">Book a class</action-button>\n<action-button slot="actions" variant="ghost">See the schedule</action-button>' }, 'logo-cloud', 'feature-grid', ['testimonial-card', 'half'], ['testimonial-card', 'half'], 'faq-list', 'newsletter-signup', 'site-footer'] },
  dashboard: { label: 'A dashboard', items: ['nav-bar', ['stat-card', 'third'], ['stat-card', 'third'], ['stat-card', 'third'], ['bar-chart', 'half'], ['progress-bar', 'half'], 'data-table'] },
  account: { label: 'Account settings', items: ['nav-bar', 'breadcrumb-trail', ['text-field', 'half'], ['select-field', 'half'], 'radio-group', 'check-box', 'toggle-switch', 'alert-banner', 'action-button'] },
  blank: { label: 'A blank page', items: [] },
};

// ---- slotted HTML comes from people (and from shared links): keep markup, drop anything that runs

const DROP = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'STYLE', 'LINK', 'META', 'BASE', 'FORM', 'FRAME', 'FRAMESET', 'TEMPLATE']);
export function clean(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 8) { child.remove(); continue; }
      if (child.nodeType !== 1) continue;
      if (DROP.has(child.tagName)) { child.remove(); continue; }
      for (const { name, value } of [...child.attributes]) {
        if (/^on/i.test(name) || name === 'srcdoc' || (/^(href|src|action|formaction|xlink:href)$/i.test(name) && /^\s*(javascript|data|vbscript):/i.test(value.replace(/[\u0000- ]/g, '')))) child.removeAttribute(name);
      }
      walk(child);
    }
  };
  walk(template.content);
  return template.innerHTML;
}

const encode = (value) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const decode = (text) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const indent = (text, pad) => text.split('\n').map((line) => (line ? pad + line : line)).join('\n');
const camel = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const js = (value) => JSON.stringify(value, null, 2);

export async function startComposer() {
  const $ = (selector) => document.querySelector(selector);
  const data = await (await fetch('./catalog.json')).json();
  const byName = Object.fromEntries(data.components.map((component) => [component.name, component]));
  const loaded = new Set();
  const load = (name) => { if (!loaded.has(name)) { loaded.add(name); return import(`../preview/${name}.js`); } return Promise.resolve(); };
  // Components the composer's own controls use.
  await Promise.all(['segmented-control', 'select-field', 'text-field', 'check-box'].map(load));
  await customElements.whenDefined('segmented-control');

  // The canvas's theme: compiled here, fixed to the chosen mode, so the site's own light or dark
  // setting can't reach into the page being composed.
  const themeSets = Object.fromEntries(await Promise.all(data.themes.map(async ({ name }) => [name, await (await fetch(`../themes/sets/${name}.json`)).json()])));
  const canvasStyle = document.head.appendChild(document.createElement('style'));
  const styleCanvas = () => {
    const theme = resolveTheme(themeSets, page.theme);
    const colors = theme.colors?.[page.mode === 'dark' ? 'dark' : 'light'] ?? {};
    canvasStyle.textContent = compileTheme({ 'compose-canvas': { colorScheme: page.mode === 'dark' ? 'dark' : 'light', colors: { light: colors, dark: colors }, fonts: theme.fonts, tokens: theme.tokens } }, 'compose-canvas');
  };

  let next = 1;
  const make = (name, width = 'full') => {
    const demo = byName[name]?.demo ?? {};
    // A demo's opener or trigger shows a closed dialog or nothing; on a page you'd want it open-able, so keep its props as they are.
    return { uid: next++, name, width, attrs: { ...demo.attrs }, props: JSON.parse(JSON.stringify(demo.props ?? {})), html: demo.html ?? '' };
  };
  const fromTemplate = (key) => ({ theme: page?.theme ?? 'zinc', mode: page?.mode ?? 'light', items: TEMPLATES[key].items.map((entry) => (Array.isArray(entry) ? make(...entry) : typeof entry === 'object' ? { ...make(entry.name, entry.width), html: entry.html ?? make(entry.name).html } : make(entry))) });
  // Components used inside another's content (an action-button in a hero's actions) load and install too.
  const nested = (html) => [...String(html).matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]+)/g)].map(([, tag]) => tag).filter((tag) => byName[tag]);
  let page = null;
  try {
    const shared = location.hash.match(/page=([\w-]+)/)?.[1];
    page = shared ? decode(shared) : JSON.parse(store.get(STORE) ?? 'null');
  } catch { page = null; }
  if (!page?.items) page = fromTemplate('landing');
  // Only what the composer knows: unknown components and widths are dropped, HTML is cleaned.
  page.items = page.items.filter((item) => byName[item.name]).map((item) => ({ ...item, uid: next++, width: WIDTHS[item.width] ? item.width : 'full', html: clean(item.html), attrs: { ...item.attrs }, props: { ...item.props } }));
  if (!data.themes.some((theme) => theme.name === page.theme)) page.theme = 'zinc';
  let selected = page.items[0]?.uid ?? null;
  let format = 'html';
  let viewport = 'desktop';

  const status = (text) => { $('#compose-status').textContent = text; };
  const save = () => store.set(STORE, JSON.stringify(page));

  // ---- the bar
  const template = $('#compose-template');
  template.options = [{ value: '', label: 'Keep this page' }, ...Object.entries(TEMPLATES).map(([value, { label }]) => ({ value, label }))];
  template.value = '';
  template.addEventListener('valuechange', (event) => {
    if (!event.detail) return;
    page = fromTemplate(event.detail);
    selected = page.items[0]?.uid ?? null;
    template.value = '';
    render();
    status(`Started from ${TEMPLATES[event.detail].label.toLowerCase()}.`);
  });
  const theme = $('#compose-theme');
  theme.options = data.themes.map(({ name, label }) => ({ value: name, label }));
  theme.addEventListener('valuechange', (event) => { page.theme = event.detail; render(); });
  const mode = $('#compose-mode');
  mode.options = [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }];
  mode.addEventListener('valuechange', (event) => { page.mode = event.detail; render(); });
  const width = $('#compose-width');
  width.options = Object.keys(VIEWPORTS).map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
  width.value = viewport;
  width.addEventListener('valuechange', (event) => { viewport = event.detail; render(); });
  const formatControl = $('#compose-format');
  formatControl.options = [{ value: 'html', label: 'HTML page' }, { value: 'react', label: 'React' }, { value: 'vue', label: 'Vue' }];
  formatControl.value = format;
  formatControl.addEventListener('valuechange', (event) => { format = event.detail; renderCode(); });

  // ---- the library
  const library = $('#compose-library');
  const drawLibrary = () => {
    const words = $('#compose-search').value.toLowerCase().split(/\s+/).filter(Boolean);
    const groups = Object.entries(data.categories).map(([category, heading]) => {
      const items = data.components.filter((component) => component.category === category && words.every((word) => `${component.name} ${heading} ${component.summary}`.toLowerCase().includes(word)));
      if (!items.length) return '';
      return `<section><h3>${heading}</h3><ul>${items.sort((a, b) => a.name.localeCompare(b.name)).map((component) => `<li><button type="button" class="composer-add" data-add="${component.name}" aria-label="Add ${component.name}" title="${escapeHtml(component.summary)}"><span aria-hidden="true">+</span> ${component.name}</button></li>`).join('')}</ul></section>`;
    }).join('');
    library.innerHTML = groups || '<p class="hint">Nothing matches.</p>';
  };
  $('#compose-search').addEventListener('input', drawLibrary);
  library.addEventListener('click', (event) => {
    const name = event.target.closest('[data-add]')?.dataset.add;
    if (!name) return;
    const item = make(name);
    const at = page.items.findIndex((other) => other.uid === selected);
    page.items.splice(at === -1 ? page.items.length : at + 1, 0, item);
    selected = item.uid;
    render();
    status(`Added ${name}.`);
    $(`[data-uid="${item.uid}"]`)?.focus();
  });

  // ---- the canvas
  const canvas = $('#compose-canvas');
  const moveItem = (uid, by) => {
    const at = page.items.findIndex((item) => item.uid === uid);
    const to = at + by;
    if (at === -1 || to < 0 || to >= page.items.length) return;
    const [item] = page.items.splice(at, 1);
    page.items.splice(to, 0, item);
    render();
    status(`Moved ${item.name} ${by < 0 ? 'up' : 'down'}.`);
    $(`[data-uid="${uid}"]`)?.focus();
  };
  const removeItem = (uid) => {
    const at = page.items.findIndex((item) => item.uid === uid);
    if (at === -1) return;
    const [item] = page.items.splice(at, 1);
    selected = page.items[Math.min(at, page.items.length - 1)]?.uid ?? null;
    render();
    status(`Removed ${item.name}.`);
    (selected ? $(`[data-uid="${selected}"]`) : library.querySelector('button'))?.focus();
  };
  canvas.addEventListener('click', (event) => {
    const tool = event.target.closest('[data-tool]');
    const wrapper = event.target.closest('[data-uid]');
    if (!wrapper) return;
    const uid = Number(wrapper.dataset.uid);
    if (tool) {
      event.preventDefault();
      const action = tool.dataset.tool;
      if (action === 'up') moveItem(uid, -1);
      else if (action === 'down') moveItem(uid, 1);
      else if (action === 'remove') removeItem(uid);
      else if (action === 'copy') {
        const at = page.items.findIndex((item) => item.uid === uid);
        const copy = { ...JSON.parse(JSON.stringify(page.items[at])), uid: next++ };
        page.items.splice(at + 1, 0, copy);
        selected = copy.uid;
        render();
        status(`Duplicated ${copy.name}.`);
      }
      return;
    }
    // Links and buttons inside a component don't navigate or submit while composing.
    if (event.target.closest('a[href], button[type=submit], form')) event.preventDefault();
    if (selected !== uid) { selected = uid; renderInspector(); markSelected(); }
  });
  canvas.addEventListener('submit', (event) => event.preventDefault(), true);
  canvas.addEventListener('keydown', (event) => {
    const wrapper = event.target.closest('[data-uid]');
    if (!wrapper || event.target !== wrapper) return;
    const uid = Number(wrapper.dataset.uid);
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) { event.preventDefault(); moveItem(uid, event.key === 'ArrowUp' ? -1 : 1); }
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); removeItem(uid); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selected = uid; renderInspector(); markSelected(); $('#compose-inspector input, #compose-inspector textarea, #compose-inspector select')?.focus(); }
  });
  canvas.addEventListener('focusin', (event) => {
    const wrapper = event.target.closest('[data-uid]');
    if (wrapper && event.target === wrapper && Number(wrapper.dataset.uid) !== selected) { selected = Number(wrapper.dataset.uid); renderInspector(); markSelected(); }
  });
  // Drag to reorder (the arrow buttons and Alt+arrows do the same without a mouse).
  let dragging = null;
  canvas.addEventListener('dragstart', (event) => {
    const wrapper = event.target.closest?.('[data-uid]');
    if (!wrapper) return;
    dragging = Number(wrapper.dataset.uid);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(dragging));
  });
  canvas.addEventListener('dragover', (event) => { if (dragging != null) event.preventDefault(); });
  canvas.addEventListener('drop', (event) => {
    const target = event.target.closest('[data-uid]');
    if (dragging == null || !target) return;
    event.preventDefault();
    const from = page.items.findIndex((item) => item.uid === dragging);
    const [item] = page.items.splice(from, 1);
    const to = page.items.findIndex((other) => other.uid === Number(target.dataset.uid));
    const box = target.getBoundingClientRect();
    page.items.splice(event.clientY > box.top + box.height / 2 ? to + 1 : to, 0, item);
    dragging = null;
    render();
  });
  canvas.addEventListener('dragend', () => { dragging = null; });

  const markSelected = () => {
    for (const wrapper of canvas.querySelectorAll('[data-uid]')) wrapper.classList.toggle('composer-selected', Number(wrapper.dataset.uid) === selected);
  };

  async function drawCanvas() {
    await Promise.all(page.items.flatMap((item) => [item.name, ...nested(item.html)]).map(load));
    styleCanvas();
    $('#compose-frame').style.maxWidth = VIEWPORTS[viewport];
    canvas.replaceChildren(...page.items.map((item, index) => {
      const wrapper = document.createElement('div');
      wrapper.className = `composer-item composer-${item.width}`;
      wrapper.dataset.uid = item.uid;
      wrapper.tabIndex = 0;
      wrapper.draggable = true;
      wrapper.setAttribute('role', 'group');
      wrapper.setAttribute('aria-label', `${item.name}, ${index + 1} of ${page.items.length}. Enter to change it, Alt and arrow keys to move it, Delete to remove it.`);
      const tools = document.createElement('div');
      tools.className = 'composer-tools';
      tools.innerHTML = `<span class="composer-name">${item.name}</span><button type="button" data-tool="up" aria-label="Move ${item.name} up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-tool="down" aria-label="Move ${item.name} down" ${index === page.items.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-tool="copy" aria-label="Duplicate ${item.name}">⧉</button><button type="button" data-tool="remove" aria-label="Remove ${item.name}">×</button>`;
      const element = document.createElement(item.name);
      for (const [name, value] of Object.entries(item.attrs)) element.setAttribute(name, value);
      element.innerHTML = clean(item.html);
      Object.assign(element, item.props);
      wrapper.append(tools, element);
      return wrapper;
    }));
    if (!page.items.length) canvas.innerHTML = '<div class="composer-empty"><p><strong>An empty page.</strong></p><p>Add components from the list, or start from a template above.</p></div>';
    markSelected();
  }

  // ---- the inspector: a field per property, by its type
  const inspector = $('#compose-inspector');
  function renderInspector() {
    const item = page.items.find((other) => other.uid === selected);
    if (!item) { inspector.innerHTML = '<p class="hint">Choose something on the page to change it.</p>'; return; }
    const component = byName[item.name];
    const rows = component.props.map((prop) => {
      const id = `prop-${prop.name}`;
      const fromAttr = prop.attribute && prop.attribute in item.attrs;
      const value = prop.name in item.props ? item.props[prop.name] : fromAttr ? item.attrs[prop.attribute] : undefined;
      const type = prop.type;
      if (/boolean/.test(type)) return `<label class="composer-check"><input type="checkbox" id="${id}" data-prop="${prop.name}" data-kind="boolean" ${value === true || value === '' || (value === undefined && prop.default === 'true') ? 'checked' : ''}> ${prop.name}</label>`;
      if (/^number/.test(type)) return `<label class="composer-field" for="${id}">${prop.name}<input type="number" id="${id}" data-prop="${prop.name}" data-kind="number" value="${escapeHtml(value ?? prop.default ?? '')}" step="any"></label>`;
      if (/\[\]|\{|unknown|any|object/.test(type) || (value !== undefined && typeof value === 'object')) return `<label class="composer-field" for="${id}">${prop.name} <small>(JSON)</small><textarea id="${id}" rows="5" data-prop="${prop.name}" data-kind="json" spellcheck="false">${escapeHtml(JSON.stringify(value ?? JSON.parse(prop.default || 'null'), null, 2))}</textarea></label>`;
      return `<label class="composer-field" for="${id}">${prop.name}<input type="text" id="${id}" data-prop="${prop.name}" data-kind="text" data-attribute="${prop.attribute ?? ''}" value="${escapeHtml(value ?? String(prop.default ?? '').replace(/^"|"$/g, ''))}"></label>`;
    }).join('');
    const slots = component.slots.length ? `<label class="composer-field" for="prop-html">Content <small>(HTML, for its slots${component.slots.filter((slot) => slot !== 'default').length ? `: ${component.slots.filter((slot) => slot !== 'default').map((slot) => `slot="${slot}"`).join(', ')}` : ''})</small><textarea id="prop-html" rows="6" data-kind="html" spellcheck="false">${escapeHtml(item.html)}</textarea></label>` : '';
    inspector.innerHTML = `<p class="composer-picked"><strong>${item.name}</strong> <a href="../components/${item.name}/">Docs</a></p><p class="hint">${escapeHtml(component.summary)}</p>
      <label class="composer-field" for="prop-width">Width in its row<select id="prop-width" data-kind="width">${Object.entries(WIDTHS).map(([value, label]) => `<option value="${value}" ${item.width === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      ${rows}${slots}<p class="hint" id="inspector-problem" role="alert"></p>`;
  }
  inspector.addEventListener('change', (event) => {
    const field = event.target;
    const item = page.items.find((other) => other.uid === selected);
    if (!item || !field.dataset.kind) return;
    const problem = $('#inspector-problem');
    if (problem) problem.textContent = '';
    if (field.dataset.kind === 'width') item.width = field.value;
    else if (field.dataset.kind === 'html') item.html = clean(field.value);
    else if (field.dataset.kind === 'boolean') item.props[field.dataset.prop] = field.checked;
    else if (field.dataset.kind === 'number') item.props[field.dataset.prop] = field.value === '' ? null : Number(field.value);
    else if (field.dataset.kind === 'json') {
      try { item.props[field.dataset.prop] = JSON.parse(field.value); } catch { problem.textContent = `That isn't valid JSON for ${field.dataset.prop}; the last good value is kept.`; return; }
    } else if (field.dataset.attribute) item.attrs[field.dataset.attribute] = field.value;
    else item.props[field.dataset.prop] = field.value;
    render({ inspector: false });
  });

  // ---- taking it home
  const used = () => [...new Set(page.items.flatMap((item) => [item.name, ...nested(item.html)]))];
  const propsOf = (item) => Object.entries(item.props).filter(([, value]) => value !== undefined);
  const gridCss = '.page { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 1.25rem; padding: 1.25rem; }\n.page > * { grid-column: span 6; }\n.page > .half { grid-column: span 3; }\n.page > .third { grid-column: span 2; }\n@media (max-width: 40rem) { .page > .half, .page > .third { grid-column: span 6; } }';
  const markup = (item, attrs = item.attrs) => {
    const list = Object.entries(attrs).map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join('');
    const cls = item.width === 'full' ? '' : ` class="${item.width}"`;
    return item.html ? `<${item.name}${cls}${list}>\n${indent(item.html, '  ')}\n</${item.name}>` : `<${item.name}${cls}${list}></${item.name}>`;
  };
  function htmlPage() {
    // Plain elements need nothing else; the two that need the runtime get an import map for it.
    const needsRuntime = used().some((name) => !byName[name].plain);
    const scripts = used().map((name) => `<script type="module" src="${data.baseUrl}/${byName[name].plain ? 'cdn' : 'preview'}/${name}.js"></script>`).join('\n  ');
    const body = page.items.map((item) => markup(item, propsOf(item).length ? { id: `c${item.uid}`, ...item.attrs } : item.attrs)).join('\n');
    const assignments = page.items.filter((item) => propsOf(item).length).map((item) => `Object.assign(document.getElementById('c${item.uid}'), ${js(Object.fromEntries(propsOf(item)))});`).join('\n');
    return `<!doctype html>
<html lang="en" data-theme="${page.theme}"${page.mode === 'dark' ? ' class="dark"' : ''}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My page</title>
  <link rel="stylesheet" href="${data.baseUrl}/themes/default.css">
  <link rel="stylesheet" href="${data.baseUrl}/themes/sets/all.css">
  ${needsRuntime ? `<script type="importmap">${JSON.stringify(data.importMap)}</script>\n  ` : ''}${scripts}
  <style>
${indent(gridCss, '    ')}
  </style>
</head>
<body>
<main class="page">
${indent(body, '  ')}
</main>
${assignments ? `<script type="module">\n${indent(assignments, '  ')}\n</script>\n` : ''}</body>
</html>
`;
  }
  function reactFile() {
    const imports = used().map((name) => `import './components/zubra/${name}.js';`).join('\n');
    const consts = page.items.flatMap((item) => propsOf(item).map(([name, value]) => `const ${camel(item.name)}${item.uid}${name[0].toUpperCase()}${name.slice(1)} = ${js(value)};`)).join('\n');
    const jsx = page.items.map((item) => {
      const attrs = Object.entries(item.attrs).map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join('');
      const props = propsOf(item).map(([name]) => ` ${name}={${camel(item.name)}${item.uid}${name[0].toUpperCase()}${name.slice(1)}}`).join('');
      const cls = item.width === 'full' ? '' : ` className="${item.width}"`;
      const html = item.html.replace(/\bclass=/g, 'className=');
      return html ? `<${item.name}${cls}${attrs}${props}>\n${indent(html, '  ')}\n</${item.name}>` : `<${item.name}${cls}${attrs}${props}></${item.name}>`;
    }).join('\n');
    return `${imports}\nimport './components/zubra/themes/${page.theme}.css';\n// The page grid: .page { display: grid; grid-template-columns: repeat(6, 1fr); } .half { grid-column: span 3 } .third { grid-column: span 2 }\n\n${consts ? `${consts}\n\n` : ''}export function Page() {\n  return (\n    <main className="page" data-theme="${page.theme}">\n${indent(jsx, '      ')}\n    </main>\n  );\n}\n`;
  }
  function vueFile() {
    const imports = used().map((name) => `import './components/zubra/${name}.js';`).join('\n');
    const consts = page.items.flatMap((item) => propsOf(item).map(([name, value]) => `const ${camel(item.name)}${item.uid}${name[0].toUpperCase()}${name.slice(1)} = ${js(value)};`)).join('\n');
    const template = page.items.map((item) => {
      const attrs = Object.entries(item.attrs).map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join('');
      const props = propsOf(item).map(([name]) => ` :${name}.prop="${camel(item.name)}${item.uid}${name[0].toUpperCase()}${name.slice(1)}"`).join('');
      const cls = item.width === 'full' ? '' : ` class="${item.width}"`;
      return item.html ? `<${item.name}${cls}${attrs}${props}>\n${indent(item.html, '  ')}\n</${item.name}>` : `<${item.name}${cls}${attrs}${props}></${item.name}>`;
    }).join('\n');
    return `<script setup>\n${imports}\nimport './components/zubra/themes/${page.theme}.css';\n${consts ? `\n${consts}\n` : ''}</script>\n\n<template>\n  <main class="page" data-theme="${page.theme}">\n${indent(template, '    ')}\n  </main>\n</template>\n\n<style>\n${gridCss}\n</style>\n\n<!-- vite.config.js: vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.includes('-') } } }) -->\n`;
  }
  function renderCode() {
    const text = format === 'react' ? reactFile() : format === 'vue' ? vueFile() : htmlPage();
    $('#compose-code').textContent = text;
    $('#compose-file').textContent = format === 'react' ? 'Page.jsx' : format === 'vue' ? 'Page.vue' : 'index.html';
    $('#compose-install').textContent = used().length ? `npx shadcn@latest add ${[...used().map((name) => `${data.baseUrl}/r/${name}.json`), `${data.baseUrl}/r/themes/${page.theme}.json`].join(' ')}` : '# Add something to the page first.';
  }
  $('#compose-download').addEventListener('click', () => {
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([htmlPage()], { type: 'text/html' })), download: 'index.html' });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    status('Downloaded index.html: open it in a browser, nothing to install.');
  });
  $('#compose-share').addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#page=${encode({ theme: page.theme, mode: page.mode, items: page.items.map(({ uid, ...item }) => item) })}`;
    history.replaceState(null, '', url);
    try { await navigator.clipboard.writeText(url); status('Copied a link to this page.'); } catch { status('The link is in the address bar.'); }
  });
  $('#compose-clear').addEventListener('click', () => {
    page = fromTemplate('blank');
    selected = null;
    render();
    status('Cleared the page.');
  });

  // While a render is under way (it may load a component first), the composer says so: data-busy.
  let renders = 0;
  async function render({ inspector: redrawInspector = true } = {}) {
    const root = document.querySelector('.composer');
    root.dataset.busy = String(++renders);
    theme.value = page.theme;
    mode.value = page.mode ?? 'light';
    await drawCanvas();
    if (redrawInspector) renderInspector();
    renderCode();
    save();
    if (root.dataset.busy === String(renders)) delete root.dataset.busy;
  }
  drawLibrary();
  await render();
  document.querySelector('.composer').dataset.ready = 'true';
}
