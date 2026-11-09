// L5 spike: a component as one plain `class extends HTMLElement`, with no runtime.
//
//   node scripts/vanilla.mjs <names…>   → dist/vanilla/<name>.js (and sizes.json)
//
// It reads the compiled module's description (props, template, styles, and the binding "parts"
// its setup returns) and writes a readable custom element: the props as accessors and observed
// attributes, the component's own script as written, and a small binder that does only what the
// parts ask for: attributes (with the runtime's URL checks), text, events (with modifiers),
// refs, classes, styles, keyed lists, zb-if, and light-DOM slots (a framework's later changes
// to the host's children are routed to them). Updates are batched in a microtask and re-run
// every binding; effect() reruns only when what it read has changed. A block imports its
// children's plain files; @zubra/runtime/primitives is imported as it is (it needs nothing else).
// Refused, with a reason: shadow DOM, and imports that need the runtime (Zag, spreads).
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
  // @zubra/runtime/primitives imports nothing else, so a plain element can import it as it is;
  // @zubra/runtime/zag needs the runtime itself.
  const subpaths = [...source.matchAll(/^import .* from ["']@zubra\/runtime\/([\w-]+)["'];?$/gm)];
  const needsRuntime = subpaths.filter(([, sub]) => sub !== 'primitives').map(([, sub]) => `@zubra/runtime/${sub}`);
  if (needsRuntime.length) throw new Error(`${name}: ${needsRuntime.join(', ')} needs the runtime; use the runtime build`);
  const keep = subpaths.map(([line]) => line);
  // A block imports the components it's made of: their plain versions, beside it.
  writeFileSync(join(tmp, `${name}.mjs`), source.replace(/^import ["']\.\/[\w-]+\.js["'];$/gm, '').replace(/from ["']@zubra\/runtime["']/g, `from './stub-${name}.mjs'`));
  const { default: definition } = await import(`${pathToFileURL(join(tmp, `${name}.mjs`)).href}?${Date.now()}`);
  return { definition, used, children, keep };
}

const className = (tag) => tag.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());

/** The helpers the component's script may call, as plain functions (only those it imports). */
const HELPERS = {
  state: `function state(value) {
  const owner = current;
  const read = () => value;
  return { [SIGNAL]: true, get: () => (reads?.push(read), value), set(next) { if (!Object.is(next, value)) { value = next; owner.request(); } } };
}`,
  effect: `function effect(run) {
  current.effects.push({ run, seen: null, cleanup: null });
}`,
  host: `function host() {
  return current;
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
  hasSlot: `function hasSlot(name = 'default') {
  const element = current;
  return { [SIGNAL]: true, get: () => element.slot(name).nodes.some(isContent) };
}`,
};

function generate(name, { definition, used, children, keep }) {
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

${[...children.map((child) => `import './${child}.js';`), ...keep].join('\n')}
const SIGNAL = Symbol('signal');
let reads = null; // while an effect runs: how to read again each value it read
// The binder's own DOM work uses the native method: the host's insertBefore goes to its slots.
const insert = (parent, node, before) => Node.prototype.insertBefore.call(parent, node, before);
let current = null; // the element whose script is running

/** A value that may be a state() or computed(): its current value. */
const $r = (value) => (value && value[SIGNAL] ? value.get() : value);
/** Text for the page: nothing for null, never an object. */
const $t = (value) => { value = $r(value); return value == null || typeof value === 'object' ? '' : String(value); };
${helpers}

function isSafeUrl(value) {
  const url = String(value).trim();
  if (!url || /[\\u0000-\\u001f\\u007f-\\u009f]/.test(url) || url.startsWith('//')) return false;
  const beforePath = url.split(/[/?#]/)[0];
  const colon = beforePath.indexOf(':');
  return colon < 0 || ['http', 'https', 'mailto', 'tel'].includes(beforePath.slice(0, colon).toLowerCase());
}

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
    // The modifiers, as the runtime applies them: .self, key filters (with the modifier keys held
    // exactly), .prevent, .stop, and the listener options.
    const m = part.modifiers;
    const apple = /mac|iphone|ipad|ipod/i.test(navigator.platform ?? '');
    const ctrl = m && (m.ctrl || (m.mod && !apple));
    const meta = m && (m.meta || (m.mod && apple));
    node.addEventListener(part.on, (event) => {
      if (m) {
        if (m.self && event.target !== node) return;
        if (m.keys) {
          const key = event.key ?? '';
          if (!m.keys.some((wanted) => (wanted.length === 1 ? key.toLowerCase() === wanted : key === wanted))) return;
          if (!!m.shift !== event.shiftKey || !!ctrl !== event.ctrlKey || !!m.alt !== event.altKey || !!meta !== event.metaKey) return;
        } else if ((m.shift && !event.shiftKey) || (ctrl && !event.ctrlKey) || (m.alt && !event.altKey) || (meta && !event.metaKey)) return;
        if (m.prevent) event.preventDefault();
        if (m.stop) event.stopPropagation();
      }
      const handler = $r(part.handler());
      if (typeof handler === 'function') handler.call(node, event);
    }, m && (m.once || m.capture || m.passive) ? { once: !!m.once, capture: !!m.capture, passive: !!m.passive } : undefined);
    return null;
  }
  if (part.ref) { part.ref()(node); return null; }
  let last;
  const changed = (value) => (Object.is(value, last) ? false : ((last = value), true));
  if (part.text) return () => { const value = part.text(); if (changed(value)) node.textContent = value; };
  if (part.anchor) {
    const text = insert(node.parentNode, document.createTextNode(''), node);
    return () => { const value = part.anchor(); if (changed(value)) text.data = value; };
  }
  if (part.classes) {
    let tokens = [];
    return () => {
      const next = String($r(part.classes()) ?? '').split(/\\s+/).filter(Boolean);
      for (const token of tokens) if (!next.includes(token)) node.classList.remove(token);
      for (const token of next) node.classList.add(token);
      tokens = next;
    };
  }
  if (part.toggle) return () => node.classList.toggle(part.toggle, Boolean(part.value()));
  if (part.property) return () => { const value = $r(part.value()); if (changed(value)) node[part.property] = value; };
  if (part.attribute) {
    return () => {
      const value = $r(part.value());
      if (!changed(value)) return;
      if (part.attribute === 'value' && 'value' in node) { if (node.value !== String(value ?? '')) node.value = value ?? ''; return; }
      if (part.boolean) { node.toggleAttribute(part.attribute, Boolean(value)); return; }
      // URLs get the runtime's check: relative, http(s), mailto or tel; a srcset, every candidate.
      if ((part.url || part.srcset) && (value == null || String(value).trim() === '')) { node.removeAttribute(part.attribute); return; }
      if ((part.url && !isSafeUrl(value)) || (part.srcset && !String(value).split(',').map((candidate) => candidate.trim().split(/\\s+/)[0]).filter(Boolean).every(isSafeUrl))) {
        console.error(\`${tag}: blocked an unsafe URL in "\${part.attribute}":\`, value);
        node.removeAttribute(part.attribute);
        return;
      }
      else if (value == null || value === false) node.removeAttribute(part.attribute);
      else node.setAttribute(part.attribute, String(value));
    };
  }
  if (part.style) {
    return () => {
      const value = $r(part.value());
      if (!changed(value)) return;
      if (value == null || value === false || value === '') node.style.removeProperty(part.style);
      else node.style.setProperty(part.style, String(value));
    };
  }
  if (part.each) return list(part, node, element);
  if (part.when) return branch(part, node, element);
  if (part.slot) return slot(part, node, element);
  throw new Error(\`${tag}: a part this spike doesn't cover: \${Object.keys(part).join(', ')}\`);
}

/** The marker that closes the region <!--[--> opens. */
function closing(open) {
  let node = open, depth = 0;
  do { node = node.nextSibling; if (node.nodeType === 8) depth += node.data === '[' ? 1 : node.data === ']' ? -1 : 0; } while (depth >= 0);
  return node;
}
function clear(open, close) {
  while (open.nextSibling !== close) open.nextSibling.remove();
}
/** A block (zb-if's branch, a slot's fallback): its nodes after \`open\`, and its updates. */
function mount(block, open, close, element) {
  const template = document.createElement('template');
  template.innerHTML = block.template;
  const fragment = template.content;
  const updates = block.parts().map((child) => bind(child, walk(fragment.firstChild, child.path), element)).filter(Boolean);
  insert(open.parentNode, fragment, close);
  return updates;
}

/** zb-if: the branch that's true, rebuilt only when the choice changes. */
function branch(part, open, element) {
  const close = closing(open);
  let shown = -1;
  let updates = [];
  return () => {
    const index = $r(part.when()) ? 0 : 1;
    if (index !== shown) {
      shown = index;
      clear(open, close);
      updates = part.blocks[index] ? mount(part.blocks[index], open, close, element) : [];
    }
    updates.forEach((update) => update());
  };
}

/**
 * zb-slot in light DOM: the host's children for this slot (collected when it started, and kept up
 * to date when a framework adds or removes them through the host), or the fallback.
 */
function slot(part, open, element) {
  const close = closing(open);
  const record = element.slot(part.slot);
  let fallback = null;
  return () => {
    if (record.nodes.some(isContent)) {
      if (fallback) { clear(open, close); fallback = null; }
      let cursor = open.nextSibling;
      for (const node of record.nodes) {
        if (node.nodeType === 1) node.setAttribute('data-zb-slotted', element.localName);
        if (node === cursor) cursor = cursor.nextSibling;
        else insert(open.parentNode, node, cursor);
      }
      return;
    }
    if (part.fallback && !fallback) { clear(open, close); fallback = mount(part.fallback, open, close, element); }
    fallback?.forEach((update) => update());
  };
}
function rowNodes(row) {
  const nodes = [];
  for (let node = row.first; node; node = node.nextSibling) { nodes.push(node); if (node === row.last) break; }
  return nodes;
}
function removeRow(row) {
  for (const node of rowNodes(row)) node.remove();
}
const isContent = (node) => node.nodeType === 1 || (node.nodeType === 3 && node.data.trim() !== '');

/** zb-each: rows by key, kept (with their focus) when the list changes, moved only when out of place. */
function list(part, open, element) {
  const block = document.createElement('template');
  block.innerHTML = part.block.template;
  let rows = new Map();
  return () => {
    const items = $r(part.each()) ?? [];
    const next = new Map();
    let after = open; // each row goes right after the one before it
    items.forEach((item, index) => {
      const key = part.key(item, index);
      let row = rows.get(key);
      if (!row || row.item !== item) {
        if (row) removeRow(row);
        const fragment = block.content.cloneNode(true);
        const updates = part.block.parts(item, index).map((child) => bind(child, walk(fragment.firstChild, child.path), element)).filter(Boolean);
        // A row is everything from its first node to its last, including what a list inside it adds later.
        row = { item, first: fragment.firstChild, last: fragment.lastChild, updates };
        insert(open.parentNode, fragment, after.nextSibling);
      }
      next.set(key, row);
      row.updates.forEach((update) => update());
      if (row.first !== after.nextSibling) {
        const before = after.nextSibling;
        for (const node of rowNodes(row)) insert(open.parentNode, node, before);
      }
      after = row.last;
    });
    for (const [key, row] of rows) if (!next.has(key)) removeRow(row);
    rows = next;
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
  #slots = new Map();
  mounted = [];
  effects = [];
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
    // The page's children for the slots, by their slot attribute, before the template replaces them.
    for (const node of [...this.childNodes]) this.slot(node.nodeType === 1 && node.getAttribute('slot') || 'default').nodes.push(node);
${styles ? `    if (!styled) { const sheet = new CSSStyleSheet(); sheet.replaceSync(styles); document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; styled = true; }\n` : ''}    const content = template.content.cloneNode(true);
    // The component's script sees its props through $p: assigning a two-way prop fires <prop>change.
    const $p = {};
    for (const [prop, spec] of Object.entries(props)) {
      Object.defineProperty($p, prop, {
        get: () => { reads?.push(() => this.#values[prop]); return this.#values[prop]; },
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

  /** A slot's record: the nodes given to it. */
  slot(name) {
    if (!this.#slots.has(name)) this.#slots.set(name, { nodes: [] });
    return this.#slots.get(name);
  }
  // Frameworks keep managing what they gave the element through the host (React and Vue call
  // insertBefore and removeChild on it): once it has started, those go to the slots.
  #slotOf(node) {
    return this.slot(node.nodeType === 1 && node.getAttribute('slot') || 'default');
  }
  insertBefore(node, before) {
    if (!this.#started) return super.insertBefore(node, before);
    if (node.nodeType === 11) { for (const child of [...node.childNodes]) this.insertBefore(child, before); return node; }
    for (const record of this.#slots.values()) record.nodes = record.nodes.filter((other) => other !== node);
    const record = this.#slotOf(node);
    const at = before ? record.nodes.indexOf(before) : -1;
    record.nodes.splice(at < 0 ? record.nodes.length : at, 0, node);
    if (!node.parentNode) document.createDocumentFragment().append(node);
    this.request();
    return node;
  }
  appendChild(node) {
    return this.insertBefore(node, null);
  }
  removeChild(node) {
    if (!this.#started) return super.removeChild(node);
    for (const record of this.#slots.values()) record.nodes = record.nodes.filter((other) => other !== node);
    node.remove();
    this.request();
    return node;
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
    // Effects run again only when something they read has changed since.
    for (const effect of this.effects) {
      if (effect.seen && effect.seen.every(([read, value]) => Object.is(read(), value))) continue;
      effect.cleanup?.();
      const outer = reads;
      reads = [];
      current = this;
      try { effect.cleanup = effect.run() ?? null; } finally {
        effect.seen = reads.map((read) => [read, read()]);
        reads = outer;
        current = null;
      }
    }
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
const refused = [];
for (const name of names) {
  let code;
  try {
    code = generate(name, await describe(name));
  } catch (error) {
    refused.push(`${name}: ${error.message.replace(`${name}: `, '')}`);
    continue;
  }
  writeFileSync(join(out, `${name}.js`), code);
  const minified = await build({ stdin: { contents: code, loader: 'js', resolveDir: out }, bundle: false, minify: true, write: false, format: 'esm', logLevel: 'error' });
  const runtime = await build({ entryPoints: [join(root, 'dist/modules', `${name}.js`)], bundle: true, minify: true, write: false, format: 'esm', logLevel: 'error', nodePaths: [join(root, 'node_modules')], external: ['./*'] });
  sizes.push({ name, plain: gzipSync(minified.outputFiles[0].contents).length, withRuntime: gzipSync(runtime.outputFiles[0].contents).length });
}
for (const line of refused) console.log(`refused ${line}`);
writeFileSync(join(out, 'sizes.json'), `${JSON.stringify(sizes, null, 2)}\n`);
for (const { name, plain, withRuntime } of sizes) console.log(`${name}: ${(plain / 1024).toFixed(1)} KB gz plain, ${(withRuntime / 1024).toFixed(1)} KB gz with the runtime bundled`);
