// The usage code on every component page actually works. The snippets come from site/snippets.js;
// this test pastes all of them, for every component, into one Vite project with an app per stack
// (HTML, React, Vue, Svelte, Angular), builds it, and checks in Chromium that every component is
// defined, renders, and received the demo's properties, with no errors.
//
// Slow (one npm install of every framework): a minute or two.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../scripts/serve.mjs';
import { demos } from '../site/demos.js';
import { snippets, STACKS } from '../site/snippets.js';

const root = join(import.meta.dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const exec = promisify(execFile);
const run = async (command, args, cwd) => (await exec(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 1 << 26 })).stdout;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const { components } = JSON.parse(readFileSync(join(root, 'components/index.json'), 'utf8'));
const names = components.map(({ name }) => name);
const isBlock = (name) => components.find((component) => component.name === name).category === 'block';

const ANGULAR = '22.2.5';
const VERSIONS = {
  vite: '8.3.6',
  react: '19.3.1', 'react-dom': '19.3.1', '@vitejs/plugin-react': '6.2.1',
  vue: '3.5.45', '@vitejs/plugin-vue': '6.0.10',
  svelte: '5.57.3', '@sveltejs/vite-plugin-svelte': '7.3.1',
  '@angular/core': ANGULAR, '@angular/common': ANGULAR, '@angular/compiler': ANGULAR, '@angular/platform-browser': ANGULAR, rxjs: '7.8.2', tslib: '2.9.1',
  '@zubra/runtime': pkg.devDependencies['@zubra/runtime'],
  // Packages components need (combo-box: Zag.js), at the versions the site is built with.
  ...Object.fromEntries(components.flatMap((component) => component.packages ?? []).map((name) => [name, pkg.devDependencies[name] ?? 'latest'])),
};

const pascal = (name) => name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
const page = (entry, body = '<div id="app"></div>') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><link rel="stylesheet" href="/src/components/zubra/theme.css"></head><body>${body}<script type="module" src="/src/${entry}"></script></body></html>`;

let dir, site, browser;
before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'zubra-ui-snippets-'));
  const files = {
    'package.json': JSON.stringify({ name: 'snippets', private: true, type: 'module' }),
    'vite.config.js': `import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { svelte } from '@sveltejs/vite-plugin-svelte';
const custom = (tag) => tag.includes('-');
export default {
  plugins: [react({ include: /\\.jsx$/ }), vue({ template: { compilerOptions: { isCustomElement: custom } } }), svelte()],
  build: { rollupOptions: { input: Object.fromEntries(${JSON.stringify(STACKS)}.map((stack) => [stack, \`\${stack}.html\`])) } },
};
`,
    // Angular in JIT mode: its decorators are the legacy ones.
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'es2022', experimentalDecorators: true, useDefineForClassFields: false } }),
  };
  // Each component's snippet in its own file, as a reader would paste it; the snippets import
  // './components/zubra/<name>.js', so they live in src/ beside the installed components.
  for (const name of names) {
    files[`src/${name}.react.jsx`] = snippets.react(name, demos[name]);
    files[`src/${name}.vue`] = snippets.vue(name, demos[name]);
    files[`src/${name}.svelte`] = snippets.svelte(name, demos[name]);
    files[`src/${name}.angular.ts`] = snippets.angular(name, demos[name]);
  }
  // Blocks last: each HTML snippet finds its element with document.querySelector, which would
  // otherwise find a block's inner one first (on a real page there's one snippet).
  const blocksLast = [...names].sort((a, b) => Number(isBlock(a)) - Number(isBlock(b)));
  files['html.html'] = page('noop.js', blocksLast.map((name) => snippets.html(name, demos[name])).join('\n\n')).replace(/'\.\/components\//g, "'/src/components/");
  files['src/noop.js'] = '';
  files['react.html'] = page('react.jsx');
  files['src/react.jsx'] = `import { createRoot } from 'react-dom/client';
${names.map((name) => `import { ${pascal(name)}Example } from './${name}.react.jsx';`).join('\n')}
createRoot(document.getElementById('app')).render(<>${names.map((name) => `<${pascal(name)}Example />`).join('')}</>);
`;
  files['vue.html'] = page('vue.js');
  files['src/vue.js'] = `import { createApp, h } from 'vue';
${names.map((name) => `import ${pascal(name)} from './${name}.vue';`).join('\n')}
createApp({ render: () => [${names.map((name) => `h(${pascal(name)})`).join(', ')}] }).mount('#app');
`;
  files['svelte.html'] = page('svelte.js');
  files['src/svelte.js'] = `import { mount } from 'svelte';
${names.map((name) => `import ${pascal(name)} from './${name}.svelte';`).join('\n')}
for (const component of [${names.map(pascal).join(', ')}]) mount(component, { target: document.getElementById('app') });
`;
  files['angular.html'] = page('angular.ts', '<app-root></app-root>');
  files['src/angular.ts'] = `import '@angular/compiler';
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
${names.map((name) => `import { ${pascal(name)}Example } from './${name}.angular';`).join('\n')}
@Component({
  selector: 'app-root',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [${names.map((name) => `${pascal(name)}Example`).join(', ')}],
  template: \`${names.map((name) => `<app-${name}-example />`).join('')}\`,
})
class App {}
bootstrapApplication(App).catch((error) => console.error(error));
`;
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  // The components as `npx shadcn add` writes them (test/shadcn.test.js covers the CLI itself).
  cpSync(join(root, 'dist/modules'), join(dir, 'src/components/zubra'), { recursive: true });
  // ZUBRA_UI_EMIT=element: the plain elements (`--emit element`) instead, where there's one.
  if (process.env.ZUBRA_UI_EMIT === 'element') cpSync(join(root, 'dist/elements'), join(dir, 'src/components/zubra'), { recursive: true, filter: (path) => !path.endsWith('.json') });
  cpSync(join(root, 'themes/default.css'), join(dir, 'src/components/zubra/theme.css'));
  // The image-gallery snippet reads gallery/gallery.json, as `npx zubra-imager` writes it.
  cpSync(join(root, 'dist/gallery'), join(dir, 'public/gallery'), { recursive: true });
  await run(npm, ['install', '--no-audit', '--no-fund', ...Object.entries(VERSIONS).map(([name, version]) => `${name}@${version}`)], dir);
  await run(process.execPath, [join(dir, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'error'], dir);
  site = await serve(join(dir, 'dist'));
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  site?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

for (const stack of STACKS) {
  test(`${stack}: every component's snippet renders with its demo's properties`, async () => {
    const tab = await browser.newPage();
    const problems = [];
    tab.on('pageerror', (error) => problems.push(error.message));
    tab.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    tab.on('requestfailed', (request) => problems.push(`failed: ${request.url()}`));
    await tab.goto(`${site.url}/${stack}.html`, { waitUntil: 'networkidle' });
    // Properties the demo sets (a dialog's `open` belongs to its opener button, so it's left out).
    const expected = Object.fromEntries(names.map((name) => [name, Object.fromEntries(Object.entries(demos[name].props ?? {}).filter(([prop]) => !(demos[name].opener && prop === 'open')))]));
    const results = await tab.evaluate(async (expected) => {
      const out = {};
      for (const [name, props] of Object.entries(expected)) {
        // The snippet's own element, not one inside another component (a block's segmented-control).
        const inside = Object.keys(expected).filter((other) => other !== name).join(',');
        const element = [...document.querySelectorAll(name)].find((el) => !el.parentElement?.closest(inside));
        if (!element) { out[name] = 'missing'; continue; }
        if (!customElements.get(name)) { out[name] = 'not defined'; continue; }
        await element.updateComplete;
        const content = element.shadowRoot?.childElementCount ?? element.childElementCount;
        const wrong = Object.entries(props).filter(([prop, value]) => JSON.stringify(element[prop]) !== JSON.stringify(value)).map(([prop]) => prop);
        out[name] = !content ? 'empty' : wrong.length ? `wrong ${wrong.join(', ')}` : 'ok';
      }
      return out;
    }, expected);
    const failures = Object.entries(results).filter(([, result]) => result !== 'ok').map(([name, result]) => `${name}: ${result}`);
    assert.deepEqual([...failures, ...problems], []);
    await tab.close();
  });
}
