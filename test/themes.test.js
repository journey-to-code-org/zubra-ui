// The theme compiler: inheritance, scoping, dark values, and refusing values that could break out
// of a declaration (a theme can come from the site's editor or another person).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { compileTheme, loadThemes, resolveTheme } from '../scripts/themes.mjs';

const root = join(import.meta.dirname, '..');
const themes = loadThemes(join(root, 'themes/sets'));

test('every theme compiles, scoped to its own data-theme, with both schemes', () => {
  for (const name of Object.keys(themes)) {
    const css = compileTheme(themes, name);
    assert.match(css, new RegExp(`^\\[data-theme="${name}"\\] \\{`, 'm'));
    assert.match(css, /color-scheme: light;/);
    assert.match(css, /color-scheme: dark;/);
    for (const variable of ['--background', '--foreground', '--primary', '--primary-foreground', '--border', '--radius', '--chart-1', '--duration-normal']) {
      assert.match(css, new RegExp(`${variable}:`), `${name} sets ${variable}`);
    }
  }
});

test('a theme inherits what it doesn\'t set, and its dark values apply under .dark', () => {
  const merged = resolveTheme({ base: { colors: { light: { primary: 'red', border: 'grey' }, dark: { primary: 'pink' } }, tokens: { radius: '1rem' } }, child: { extends: 'base', colors: { light: { primary: 'blue' } } } }, 'child');
  assert.deepEqual(merged.colors.light, { primary: 'blue', border: 'grey' });
  assert.deepEqual(merged.colors.dark, { primary: 'pink' });
  assert.equal(merged.tokens.radius, '1rem');
  const css = compileTheme({ a: { colors: { light: { primary: 'red' }, dark: { primary: 'pink' } } } }, 'a');
  assert.match(css, /\.dark \[data-theme="a"\], \[data-theme="a"\]\.dark \{\n  --primary: pink;/);
  const darkFirst = compileTheme({ a: { colorScheme: 'dark', colors: { light: { primary: 'red' }, dark: { primary: 'pink' } } } }, 'a');
  assert.match(darkFirst, /^\[data-theme="a"\] \{\n  --primary: pink;/m, 'dark-first: dark is the default');
  assert.match(darkFirst, /\.light \[data-theme="a"\], \[data-theme="a"\]\.light \{\n  --primary: red;/);
});

test('values that could escape a declaration, loops and bad names are refused', () => {
  assert.throws(() => compileTheme({ a: { colors: { light: { primary: 'red; } body { display: none' } } } }, 'a'), /can't contain/);
  assert.throws(() => compileTheme({ a: { tokens: { radius: '1rem/* x */' } } }, 'a'), /can't contain/);
  assert.throws(() => compileTheme({ a: { extends: 'b' }, b: { extends: 'a' } }, 'a'), /loop/);
  assert.throws(() => compileTheme({ 'A b': {} }, 'A b'), /lowercase/);
  assert.throws(() => compileTheme({}, 'missing'), /no theme/);
});
