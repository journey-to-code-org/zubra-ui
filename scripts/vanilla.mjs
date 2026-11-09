// L5 spike: a component as one plain `class extends HTMLElement`, with no imports.
//
//   node scripts/vanilla.mjs toggle-switch quantity-stepper tag-input   → dist/vanilla/<name>.js
//
// It reads the compiled module's description (props, template, styles, and the binding "parts"
// its setup returns) and writes a readable custom element: the props as accessors and observed
// attributes, the component's own script as written, and a small binder that does only what the
// parts ask for. Updates are batched in a microtask and re-run every binding (no signals graph):
// fine for small components, and what keeps it small. Not covered (a spike): shadow DOM slots,
// zb-if, spreads, styles and classes directives, hydration of server markup.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist/vanilla');
const names = process.argv.slice(2);

/** The compiled module's description, by running it against a stand-in runtime. */
async function describe(name) {
  const source = readFileSync(join(root, 'dist/modules', `${name}.js`), 'utf8');
  const used = new Set([...source.matchAll(/import \{([^}]*)\} from ["']@zubra\/runtime["']/g)].flatMap(([, list]) => list.split(',').map((item) => item.trim().split(/\s+as\s+/)[0]).filter(Boolean)));
  const tmp = join(root, 'node_modules/.cache/zubra-ui/vanilla');
  mkdirSync(tmp, { recursive: true });
  const stub = [...new Set([...used, '$define'])].map((item) => (item === '$define' ? 'export const $define = (tag, definition) => ({ tag, ...definition });' : `export const ${item} = () => {};`)).join('\n');
  writeFileSync(join(tmp, `stub-${name}.mjs`), stub);
  const children = [...source.matchAll(/^import ["']\.\/([\w-]+)\.js["'];$/gm)].map(([, child]) => child);
  if (children.length) throw new Error(`${name}: imports other components (${children.join(', ')}); not in the spike`);
  writeFileSync(join(tmp, `${name}.mjs`), source.replace(/from ["']@zubra\/runtime["']/g, `from './stub-${name}.mjs'`));
  const { default: definition } = await import(`${pathToFileURL(join(tmp, `${name}.mjs`)).href}?${Date.now()}`);
  return { definition, used };
}

const className = (tag) => tag.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());

/** The helpers the component's script may call, as plain functions (only those it imports). */
const HELPERS = {
  state: `function state(value) {
  const owner = current;
  return { [SIGNAL]: true, get: () => value, set(next) { if (!Object.is(next, value)) { value = next; owner.request(); } } };
}`,
  computed: `function computed(read) {
  return { [SIGNAL]: true, get: read };
}`,
  id: `let ids = 0;
function id() {
  return \`\${current.localName}-\${++ids}\`;
}`,
  formValue: `function formValue(read) {
  current.formRead = read;
}`,
  validity: `function validity(read) {
  current.validityRead = read;
}`,
  emit: `function emit(name, detail) {
  return current.fire(name, detail);
}`,
  onMount: `function onMount(callback) {
  current.mounted.push(callback);
}`,
  hasSlot: `function hasSlot() {
  return { [SIGNAL]: true, get: () => true };
}`,
};

function generate(name, { definition, used }) {
  const { tag, props, template, styles, form, events, setup } = definition;
  if (definition.shadow) throw new Error(`${name}: shadow DOM isn't in the spike`);
  const unsupported = [...used].filter((item) => !['$define', '$r', '$t', 'state', 'computed', ...Object.keys(HELPERS)].includes(item));
  if (unsupported.length) throw new Error(`${name}: uses ${unsupported.join(', ')}, which the spike doesn't cover`);
  const setupSource = setup.toString().replace(/^setup\s*\(/, 'function setup(').replace(/__zubraState/g, 'state').replace(/__zubraComputed/g, 'computed');
  const attributes = Object.fromEntries(Object.entries(props).map(([prop, spec]) => [spec.attribute, prop]));
  const helpers = [...used].filter((item) => HELPERS[item]).map((item) => HELPERS[item]).join('\n');
  const Class = className(tag);
  return `// ${tag}: generated from ${name}.zb as a plain custom element (Zubra UI's L5 spike).
// No imports: the component's props, its template and its own script, and a small binder.

const SIGNAL = Symbol('signal');
let current = null; // the element whose script is running

/** A value that may be a state() or computed(): its current value. */
const $r = (value) => (value && value[SIGNAL] ? value.get() : value);
/** Text for the page: nothing for null, never an object. */
const $t = (value) => { value = $r(value); return value == null || typeof value === 'object' ? '' : String(value); };
${helpers}

/** Reads an attribute as its prop's type, from the prop's default. */
function parse(spec, raw) {
  const fallback = spec.default;
  if (typeof fallback === 'boolean') return fallback ? raw !== 'false' : raw !== null;
  if (raw === null) return structuredClone(fallback);
  if (typeof fallback === 'number') return Number(raw);
  if (typeof fallback === 'string') return raw;
  try { return JSON.parse(raw); } catch { return structuredClone(fallback); }
}

/** The positions a path counts: elements and marker comments, a region (<!--[-->…<!--]-->) as one. */
function* positions(first, stop) {
  for (let node = first; node && node !== stop; node = node.nextSibling) {
    if (node.nodeType === 1) yield node;
    else if (node.nodeType === 8 && (node.data === '' || node.data === '[')) {
      yield node;
      if (node.data === '[') { let depth = 1; while (depth && (node = node.nextSibling)) { if (node.nodeType === 8) depth += node.data === '[' ? 1 : node.data === ']' ? -1 : 0; } }
    }
  }
}
function walk(first, path) {
  let node = null;
  for (const index of path) {
    let seen = -1;
    for (const candidate of positions(first, null)) if (++seen === index) { node = candidate; break; }
    first = node.firstChild;
  }
  return node;
}

/** What one part does to its node, re-run on each update. Returns the update function. */
function bind(part, node, element) {
  if (part.on) {
    node.addEventListener(part.on, (event) => part.handler()(event));
    return null;
  }
  if (part.ref) { part.ref()(node); return null; }
  let last;
  const changed = (value) => (Object.is(value, last) ? false : ((last = value), true));
  if (part.text) return () => { const value = part.text(); if (changed(value)) node.textContent = value; };
  if (part.anchor) {
    const text = node.parentNode.insertBefore(document.createTextNode(''), node);
    return () => { const value = part.anchor(); if (changed(value)) text.data = value; };
  }
  if (part.toggle) return () => node.classList.toggle(part.toggle, Boolean(part.value()));
  if (part.property) return () => { const value = $r(part.value()); if (changed(value)) node[part.property] = value; };
  if (part.attribute) {
    return () => {
      const value = $r(part.value());
      if (!changed(value)) return;
      if (part.attribute === 'value' && 'value' in node) { if (node.value !== String(value ?? '')) node.value = value ?? ''; return; }
      if (part.boolean) node.toggleAttribute(part.attribute, Boolean(value));
      else if (value == null || value === false) node.removeAttribute(part.attribute);
      else node.setAttribute(part.attribute, String(value));
    };
  }
  if (part.each) return list(part, node, element);
  throw new Error(\`${tag}: a part this spike doesn't cover: \${Object.keys(part).join(', ')}\`);
}

/** zb-each: rows by key, kept (with their focus) when the list changes, moved only when out of place. */
function list(part, open, element) {
  const close = (() => { let node = open, depth = 0; do { node = node.nextSibling; if (node.nodeType === 8) depth += node.data === '[' ? 1 : node.data === ']' ? -1 : 0; } while (depth >= 0); return node; })();
  const block = document.createElement('template');
  block.innerHTML = part.block.template;
  let rows = new Map();
  return () => {
    const items = $r(part.each()) ?? [];
    const next = new Map();
    let cursor = open.nextSibling;
    items.forEach((item, index) => {
      const key = part.key(item, index);
      let row = rows.get(key);
      if (!row || row.item !== item) {
        row?.nodes.forEach((node) => node.remove());
        const fragment = block.content.cloneNode(true);
        const updates = part.block.parts(item, index).map((child) => bind(child, walk(fragment.firstChild, child.path), element)).filter(Boolean);
        row = { item, nodes: [...fragment.childNodes], updates };
      }
      next.set(key, row);
      row.updates.forEach((update) => update());
      if (row.nodes[0] !== cursor) row.nodes.forEach((node) => open.parentNode.insertBefore(node, cursor));
      cursor = row.nodes.at(-1).nextSibling;
    });
    for (const [key, row] of rows) if (!next.has(key)) row.nodes.forEach((node) => node.remove());
    rows = next;
    void close;
  };
}

const template = document.createElement('template');
template.innerHTML = ${JSON.stringify(template)};
const props = ${JSON.stringify(props, null, 2).replace(/\n/g, '\n')};
${styles ? `const styles = ${JSON.stringify(styles)};\nlet styled = false;` : ''}

${setupSource}

export class ${Class} extends HTMLElement {
  static observedAttributes = ${JSON.stringify(Object.keys(attributes))};
${form ? '  static formAssociated = true;\n' : ''}
  #values = Object.fromEntries(Object.entries(props).map(([prop, spec]) => [prop, structuredClone(spec.default)]));
  #updates = [];
  #pending = null;
  #started = false;
  mounted = [];
${form ? '  internals = this.attachInternals();\n' : ''}
  constructor() {
    super();
    // Properties set before the element was defined: keep them.
    for (const prop of Object.keys(props)) {
      if (Object.hasOwn(this, prop)) { const value = this[prop]; delete this[prop]; this[prop] = value; }
    }
  }

  attributeChangedCallback(attribute, _, raw) {
    const prop = ${JSON.stringify(attributes)}[attribute];
    this[prop] = parse(props[prop], raw);
  }

  connectedCallback() {
    if (this.#started) return;
    this.#started = true;
${styles ? `    if (!styled) { const sheet = new CSSStyleSheet(); sheet.replaceSync(styles); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; styled = true; }\n` : ''}    const content = template.content.cloneNode(true);
    // The component's script sees its props through $p: assigning a two-way prop fires <prop>change.
    const $p = {};
    for (const [prop, spec] of Object.entries(props)) {
      Object.defineProperty($p, prop, {
        get: () => this.#values[prop],
        set: (value) => { if (Object.is(value, this.#values[prop])) return; this[prop] = value; if (spec.model) this.fire(\`\${prop}change\`, value); },
      });
    }
    current = this;
    const parts = setup($p, (name, detail) => this.fire(name, detail));
    current = null;
    this.#updates = parts.map((part) => bind(part, walk(content.firstChild, part.path), this)).filter(Boolean);
    this.replaceChildren(content);
    this.#flush();
    for (const callback of this.mounted) callback();
  }

  /** Dispatches one of the component's events (they bubble). */
  fire(name, detail) {
    return this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, cancelable: name.startsWith('before') }));
  }

  /** Asks for an update in a microtask: several changes, one pass. */
  request() {
    this.#pending ??= Promise.resolve().then(() => this.#flush());
  }
  #flush() {
    this.#pending = null;
    if (!this.#started) return;
    for (const update of this.#updates) update();
${form ? `    if (this.formRead) this.internals.setFormValue(this.formRead() ?? null);
    if (this.validityRead) { const message = this.validityRead(); this.internals.setValidity(message ? { customError: true } : {}, message || ''); }
` : ''}  }

  /** Resolves once pending changes are on the page. */
  get updateComplete() {
    return this.#pending ?? Promise.resolve();
  }
${Object.keys(props).map((prop) => `
  get ${prop}() { return this.#values.${prop}; }
  set ${prop}(value) { if (Object.is(value, this.#values.${prop})) return; this.#values.${prop} = value; this.request(); }`).join('')}
}

if (!customElements.get(${JSON.stringify(tag)})) customElements.define(${JSON.stringify(tag)}, ${Class});
export const tag = ${JSON.stringify(tag)};
export default ${Class};
${events.length ? `// Events: ${events.join(', ')}\n` : ''}`;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const sizes = [];
for (const name of names) {
  const code = generate(name, await describe(name));
  writeFileSync(join(out, `${name}.js`), code);
  const minified = await build({ stdin: { contents: code, loader: 'js' }, minify: true, write: false, format: 'esm', logLevel: 'error' });
  const runtime = await build({ entryPoints: [join(root, 'dist/modules', `${name}.js`)], bundle: true, minify: true, write: false, format: 'esm', logLevel: 'error', nodePaths: [join(root, 'node_modules')] });
  sizes.push({ name, plain: gzipSync(minified.outputFiles[0].contents).length, withRuntime: gzipSync(runtime.outputFiles[0].contents).length });
}
writeFileSync(join(out, 'sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);
for (const { name, plain, withRuntime } of sizes) console.log(`${name}: ${(plain / 1024).toFixed(1)} KB gz plain, ${(withRuntime / 1024).toFixed(1)} KB gz with the runtime bundled`);
