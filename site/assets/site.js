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

export async function start({ stacks, stackKey, looks = [] }) {
  const html = document.documentElement;
  // On a phone the nav is one scrolling row: bring the current page into it.
  const current = document.querySelector('.site-nav [aria-current=page]');
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
  // A look: one of the scoped themes (data-theme on <html>), with its fonts, corners and motion.
  const look = document.querySelector('#look');
  look.options = looks;
  look.value = html.dataset.theme ?? 'zinc';
  look.addEventListener('valuechange', (event) => {
    if (event.detail === 'zinc') delete html.dataset.theme;
    else html.dataset.theme = event.detail;
    store.set('zubra-ui:look', event.detail === 'zinc' ? null : event.detail);
  });
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
    look.value = 'zinc';
    delete html.dataset.theme;
    store.set('zubra-ui:look', null);
    status.textContent = 'Back to the default theme.';
  });

  // Search: filters the nav by name, section and what each component is; "/" jumps to it, and
  // Enter opens the first match.
  const search = document.querySelector('#nav-search');
  const none = document.querySelector('#nav-none');
  const filter = () => {
    const words = search.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const section of document.querySelectorAll('.site-nav section')) {
      let any = false;
      for (const item of section.querySelectorAll('li')) {
        const match = words.every((word) => item.dataset.search.includes(word));
        item.hidden = !match;
        any ||= match;
        shown += match ? 1 : 0;
      }
      section.hidden = !any;
    }
    none.textContent = words.length && !shown ? 'No component matches.' : '';
  };
  search.addEventListener('input', filter);
  search.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const first = document.querySelector('.site-nav li:not([hidden]) a');
    if (first) location.href = first.href;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest('input, textarea, select, [contenteditable]')) return;
    event.preventDefault();
    search.focus();
  });

  // Package manager tabs on install commands: one choice for every command on the site.
  const showPm = () => document.querySelectorAll('[data-pm-tab]').forEach((tab) => tab.setAttribute('aria-pressed', String(tab.dataset.pmTab === html.dataset.pm)));
  showPm();
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-pm-tab]');
    if (!tab) return;
    html.dataset.pm = tab.dataset.pmTab;
    store.set('zubra-ui:pm', tab.dataset.pmTab);
    showPm();
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
export function wire(name, { props, events, opener, trigger }) {
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
  // A component driven by a document event (toast-region): the button dispatches it.
  if (trigger) stage.querySelector('[data-trigger]').addEventListener('click', () => document.dispatchEvent(new CustomEvent(trigger.event, { detail: trigger.detail })));
}
