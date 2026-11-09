// Scoped themes: a theme is a JSON file in themes/sets/ (colours for light and dark, fonts, radius,
// motion), compiled to CSS that applies wherever `data-theme="<name>"` is set: on <html> for the
// whole page, or on any element for one section. Inside it every component (they read shadcn's
// variables) takes the theme's look, so one page can hold several. A theme `extends` another and
// lists only what differs. Dark values apply under `.dark` (shadcn's switch), on the themed element
// or above it; `colorScheme: "dark"` makes a theme dark-first.
//
//   compileTheme(themes, name) → CSS text      (used by scripts/build.mjs and the site's editor)
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Every theme in a folder, by name (the file name without .json). */
export function loadThemes(dir) {
  return Object.fromEntries(readdirSync(dir).filter((file) => file.endsWith('.json')).map((file) => [file.slice(0, -5), JSON.parse(readFileSync(join(dir, file), 'utf8'))]));
}

export { compileTheme, resolveTheme } from '../site/theme-compiler.js';
