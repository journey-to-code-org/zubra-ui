// The code each component page shows for each stack, generated from its demo (site/demos.js), so
// the tabs can't disagree. test/snippets.test.js builds every stack's snippets into a real app.
//
// Each stack uses the component its own way:
//   HTML     attributes in the markup; properties and listeners from a module script
//   React    19+: properties as JSX props, events as `on<event>` props (custom elements)
//   Vue      `:prop.prop` (set as a property) and `@event`; needs isCustomElement for the tag
//   Svelte   5+: `{prop}` (a property, since the element defines it) and `on<event>`
//   Angular  `[prop]` and `(event)`, with CUSTOM_ELEMENTS_SCHEMA
export const STACKS = ['html', 'react', 'vue', 'svelte', 'angular'];
export const STACK_NAMES = { html: 'HTML', react: 'React', vue: 'Vue', svelte: 'Svelte', angular: 'Angular' };

/** A JavaScript value as source, with unquoted keys where possible, indented by `pad`. */
export function js(value, pad = '') {
  const inner = `${pad}  `;
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    const items = value.map((item) => js(item, inner));
    const flat = `[${items.join(', ')}]`;
    return flat.length <= 72 && !flat.includes('\n') ? flat : `[\n${items.map((item) => `${inner}${item}`).join(',\n')},\n${pad}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, item]) => `${/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)}: ${js(item, inner)}`);
    if (!entries.length) return '{}';
    const flat = `{ ${entries.join(', ')} }`;
    return flat.length <= 72 && !flat.includes('\n') ? flat : `{\n${entries.map((entry) => `${inner}${entry}`).join(',\n')},\n${pad}}`;
  }
  return typeof value === 'string' ? `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'` : String(value);
}

const attr = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const indent = (text, pad) => text.split('\n').map((line) => (line ? pad + line : line)).join('\n');
const camel = (name) => name.replace(/-(\w)/g, (_, c) => c.toUpperCase());
const pascal = (name) => camel(name).replace(/^\w/, (c) => c.toUpperCase());
const handlerName = (event) => `on${event[0].toUpperCase()}${event.slice(1)}`;
const importLine = (name) => `import './components/zubra/${name}.js';`;
// A component driven by a document event (toast-region): its demo's button dispatches the event.
const dispatch = (trigger, pad = '') => `document.dispatchEvent(new CustomEvent('${trigger.event}', { detail: ${js(trigger.detail, pad)} }))`;

/** The element, with children, for markup-like stacks; `bind(prop)` and `on(event)` give each stack's syntax. */
function element(name, demo, { bind, on, pad = '' }) {
  const list = [
    ...Object.entries(demo.attrs ?? {}).map(([attribute, value]) => `${attribute}="${attr(value)}"`),
    ...Object.keys(demo.props ?? {}).map(bind),
    ...(demo.events ?? []).map(on),
  ].filter(Boolean);
  const inline = `<${name}${list.map((part) => ` ${part}`).join('')}>`;
  // Past about 80 columns, one attribute per line, as a formatter would.
  const open = pad.length + inline.length <= 80 ? inline : `<${name}\n${list.map((part) => `${pad}  ${part}`).join('\n')}\n${pad}>`;
  if (!demo.html) return `${pad}${open}</${name}>`;
  return `${pad}${open}\n${indent(demo.html, `${pad}  `)}\n${pad}</${name}>`;
}

export function html(name, demo) {
  const props = Object.entries(demo.props ?? {});
  const lines = [importLine(name)];
  if (props.length || demo.events?.length || demo.opener) {
    lines.push('', `const element = document.querySelector('${name}');`);
    for (const [prop, value] of props) lines.push(`element.${prop} = ${js(value)};`);
    for (const event of demo.events ?? []) lines.push(`element.addEventListener('${event}', (event) => console.log('${event}', event.detail));`);
    if (demo.opener) lines.push(`document.querySelector('#open-${name}').addEventListener('click', () => { element.open = true; });`);
  }
  if (demo.trigger) lines.push('', `document.querySelector('#show-${name}').addEventListener('click', () => {`, `  ${dispatch(demo.trigger, '  ')};`, '});');
  const markup = [demo.opener && `<button type="button" id="open-${name}">${demo.opener}</button>`, demo.trigger && `<button type="button" id="show-${name}">${demo.trigger.label}</button>`, element(name, { ...demo, props: {}, events: [] }, { bind: () => '', on: () => '' })].filter(Boolean).join('\n');
  return `${markup}\n\n<script type="module">\n${indent(lines.join('\n'), '  ')}\n</script>`;
}

export function react(name, demo) {
  const component = `${pascal(name)}Example`;
  const toJsx = (text) => text.replace(/\bclass=/g, 'className=');
  const body = element(name, { ...demo, html: demo.html && toJsx(demo.html) }, {
    bind: (prop) => `${prop}={${prop}}`,
    on: (event) => `on${event}={(event) => console.log('${event}', event.detail)}`,
    pad: demo.opener || demo.trigger ? '      ' : '    ',
  });
  const values = Object.entries(demo.props ?? {}).filter(([prop]) => !(demo.opener && prop === 'open'));
  const lines = [importLine(name), demo.opener ? "import { useState } from 'react';" : null, ''].filter((line) => line !== null);
  for (const [prop, value] of values) lines.push(`const ${prop} = ${js(value)};`);
  if (values.length) lines.push('');
  lines.push(`export function ${component}() {`);
  if (demo.opener) {
    lines.push('  const [open, setOpen] = useState(false);');
    const withOpen = body.replace(`on${'openchange'}={(event) => console.log('openchange', event.detail)}`, 'onopenchange={(event) => setOpen(event.detail)}');
    lines.push('  return (', '    <>', `      <button type="button" onClick={() => setOpen(true)}>${demo.opener}</button>`, withOpen, '    </>', '  );');
  } else if (demo.trigger) {
    lines.push('  return (', '    <>', `      <button type="button" onClick={() => ${dispatch(demo.trigger, '      ')}}>${demo.trigger.label}</button>`, body, '    </>', '  );');
  } else {
    lines.push('  return (', body, '  );');
  }
  lines.push('}');
  return lines.join('\n');
}

export function vue(name, demo) {
  const script = [importLine(name)];
  const props = Object.entries(demo.props ?? {});
  if (demo.opener) script.unshift("import { ref } from 'vue';");
  for (const [prop, value] of props) script.push(demo.opener && prop === 'open' ? 'const open = ref(false);' : `const ${prop} = ${js(value)};`);
  for (const event of demo.events ?? []) if (!(demo.opener && event === 'openchange')) script.push(`const ${handlerName(event)} = (event) => console.log('${event}', event.detail);`);
  const body = element(name, demo, {
    bind: (prop) => `:${prop}.prop="${prop}"`,
    on: (event) => (demo.opener && event === 'openchange' ? '@openchange="open = $event.detail"' : `@${event}="${handlerName(event)}"`),
    pad: '  ',
  });
  if (demo.trigger) script.push(`const show = () => ${dispatch(demo.trigger)};`);
  const opener = demo.opener ? `  <button type="button" @click="open = true">${demo.opener}</button>\n`
    : demo.trigger ? `  <button type="button" @click="show">${demo.trigger.label}</button>\n` : '';
  return `<script setup>\n${script.join('\n')}\n</script>\n\n<template>\n${opener}${body}\n</template>\n\n<!-- vite.config.js: vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.includes('-') } } }) -->`;
}

export function svelte(name, demo) {
  const script = [importLine(name)];
  for (const [prop, value] of Object.entries(demo.props ?? {})) script.push(demo.opener && prop === 'open' ? 'let open = $state(false);' : `const ${prop} = ${js(value)};`);
  const body = element(name, demo, {
    bind: (prop) => `{${prop}}`,
    on: (event) => (demo.opener && event === 'openchange' ? 'onopenchange={(event) => (open = event.detail)}' : `on${event}={(event) => console.log('${event}', event.detail)}`),
  });
  if (demo.trigger) script.push(`const show = () => ${dispatch(demo.trigger)};`);
  const opener = demo.opener ? `<button type="button" onclick={() => (open = true)}>${demo.opener}</button>\n`
    : demo.trigger ? `<button type="button" onclick={show}>${demo.trigger.label}</button>\n` : '';
  return `<script>\n${indent(script.join('\n'), '  ')}\n</script>\n\n${opener}${body}`;
}

export function angular(name, demo) {
  const component = `${pascal(name)}Example`;
  const fields = Object.entries(demo.props ?? {}).map(([prop, value]) => `  ${prop} = ${js(value, '  ')};`);
  const handlers = (demo.events ?? []).filter((event) => !(demo.opener && event === 'openchange'))
    .map((event) => `  ${handlerName(event)}(event: Event) {\n    console.log('${event}', (event as CustomEvent).detail);\n  }`);
  const template = element(name, demo, {
    bind: (prop) => `[${prop}]="${prop}"`,
    on: (event) => (demo.opener && event === 'openchange' ? '(openchange)="open = $any($event).detail"' : `(${event})="${handlerName(event)}($event)"`),
    pad: '    ',
  });
  const opener = demo.opener ? `    <button type="button" (click)="open = true">${demo.opener}</button>\n`
    : demo.trigger ? `    <button type="button" (click)="show()">${demo.trigger.label}</button>\n` : '';
  if (demo.trigger) handlers.push(`  show() {\n    ${dispatch(demo.trigger, '    ')};\n  }`);
  return [
    "import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';",
    importLine(name),
    '',
    '@Component({',
    `  selector: 'app-${name}-example',`,
    '  schemas: [CUSTOM_ELEMENTS_SCHEMA],',
    '  template: `',
    `${opener}${template.replace(/`/g, '\\`')}`,
    '  `,',
    '})',
    `export class ${component} {`,
    [...fields, ...handlers].join('\n\n'),
    '}',
  ].join('\n');
}

export const snippets = { html, react, vue, svelte, angular };
