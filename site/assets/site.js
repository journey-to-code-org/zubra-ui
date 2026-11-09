// The site's behaviour: the stack switch, dark mode, the theme picker, copy buttons, and wiring
// each preview's props and events. Preferences are kept per visitor in localStorage, and every read
// and write is guarded, so the site works where storage is blocked.
const store = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch {} },
};
const PRESETS = [
  { value: 'zinc', label: 'Zinc' }, { value: 'blue', label: 'Blue' }, { value: 'rose', label: 'Rose' },
  { value: 'green', label: 'Green' }, { value: 'orange', label: 'Orange' },
];

export async function start({ stacks, stackKey }) {
  const html = document.documentElement;
  // On a phone the nav is one scrolling row: bring the current page into it.
  const current = document.querySelector('.side [aria-current=page]');
  if (current && matchMedia('(max-width: 52rem)').matches) current.scrollIntoView({ block: 'nearest', inline: 'center' });
  // The theme dialog moves its children into its own layout when it first renders: wait for that.
  await document.querySelector('#theme').updateComplete;

  // The stack switch: every code block on the site follows it.
  const stack = document.querySelector('#stack');
  stack.options = stacks;
  stack.value = html.dataset.stack;
  stack.addEventListener('valuechange', (event) => {
    html.dataset.stack = event.detail;
    store.set(stackKey, event.detail);
  });

  // Dark mode: shadcn's `.dark` class, which the theme's variables switch on.
  const mode = document.querySelector('#mode');
  const showMode = () => {
    const dark = html.classList.contains('dark');
    mode.setAttribute('aria-pressed', String(dark));
  };
  showMode();
  mode.addEventListener('click', () => {
    html.classList.toggle('dark');
    store.set('zubra-ui:mode', html.classList.contains('dark') ? 'dark' : 'light');
    showMode();
  });

  // The theme dialog: an accent preset, or a pasted shadcn theme.
  const dialog = document.querySelector('#theme');
  const preset = document.querySelector('#preset');
  const paste = document.querySelector('#paste');
  const status = document.querySelector('#paste-status');
  const userTheme = document.querySelector('#user-theme');
  preset.options = PRESETS;
  preset.value = store.get('zubra-ui:preset') ?? 'zinc';
  paste.value = store.get('zubra-ui:theme') ?? '';
  document.querySelector('#theme-open').addEventListener('click', () => { dialog.open = true; });
  const applyPreset = (name) => {
    for (const { value } of PRESETS) html.classList.remove(`theme-${value}`);
    if (name !== 'zinc') html.classList.add(`theme-${name}`);
    store.set('zubra-ui:preset', name === 'zinc' ? null : name);
  };
  preset.addEventListener('valuechange', (event) => applyPreset(event.detail));
  document.querySelector('#theme-apply').addEventListener('click', () => {
    const css = paste.value.trim();
    if (css && !/--[\w-]+\s*:/.test(css)) {
      status.textContent = 'No CSS variables found. Paste the :root { … } and .dark { … } blocks from your theme.';
      return;
    }
    // Only the variable declarations are kept: a pasted theme can't add other rules to the page.
    userTheme.textContent = themeCss(css);
    store.set('zubra-ui:theme', css ? userTheme.textContent : null);
    status.textContent = css ? `Applied ${countVariables(userTheme.textContent)} variables.` : 'Cleared the pasted theme.';
  });
  document.querySelector('#theme-reset').addEventListener('click', () => {
    paste.value = '';
    userTheme.textContent = '';
    store.set('zubra-ui:theme', null);
    preset.value = 'zinc';
    applyPreset('zinc');
    status.textContent = 'Back to the default theme.';
  });

  // Copy buttons on every code block.
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-copy]');
    if (!button) return;
    const text = button.closest('.code').querySelector('pre').innerText;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
    } catch {
      button.textContent = 'Press Ctrl+C';
      getSelection().selectAllChildren(button.closest('.code').querySelector('pre'));
    }
    setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
}

/** A pasted theme, reduced to its variables, for `:root` and `.dark` (other selectors are dropped). */
export function themeCss(css) {
  css = css.replace(/\/\*[\s\S]*?(\*\/|$)/g, ''); // comments could hide or swallow declarations
  const blocks = [];
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const target = /\.dark\b/.test(selector) ? 'html.dark' : /:root|html|@theme/.test(selector) ? ':root' : null;
    if (!target) continue;
    const declarations = [...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)].map(([, name, value]) => `  ${name}: ${value.trim().replace(/[<>{}]/g, '')};`);
    if (declarations.length) blocks.push(`${target} {\n${declarations.join('\n')}\n}`);
  }
  if (!blocks.length && /--[\w-]+\s*:/.test(css)) {
    // Bare declarations, without a selector: they're the light theme.
    const declarations = [...css.matchAll(/(--[\w-]+)\s*:\s*([^;\n]+);?/g)].map(([, name, value]) => `  ${name}: ${value.trim().replace(/[<>{}]/g, '')};`);
    blocks.push(`:root {\n${declarations.join('\n')}\n}`);
  }
  return blocks.join('\n');
}
const countVariables = (css) => new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name)).size;

/** Set a preview's props, show its events, and open it from its button (a dialog). */
export function wire(name, { props, events, opener }) {
  const stage = document.querySelector(`[data-preview="${name}"]`);
  const element = stage.querySelector(name);
  Object.assign(element, props);
  const log = document.querySelector(`[data-events="${name}"]`);
  const show = (value) => (typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value));
  for (const type of events) {
    element.addEventListener(type, (event) => {
      if (!log) return;
      log.replaceChildren(`${type}: `, Object.assign(document.createElement('output'), { textContent: show(event.detail) }));
    });
  }
  if (opener) stage.querySelector('[data-open]').addEventListener('click', () => { element.open = true; });
}
