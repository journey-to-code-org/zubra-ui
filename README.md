# Zubra UI

Accessible web components you copy into any project: plain HTML, React, Vue, Svelte, Angular, or anything else that renders HTML. Install them with the shadcn CLI you may already use, theme them with shadcn/ui's CSS variables, and own the code.

```sh
npx shadcn add https://journey-to-code-org.github.io/zubra-ui/r/toggle-switch.json
```

That's the whole setup:
- **No `components.json`, no Tailwind, no React required.** These are shadcn's "universal" registry items.
- **The CLI writes three things:** `src/components/zubra/toggle-switch.js`, the theme (`src/components/zubra/theme.css`), and `@zubra/runtime` in your dependencies.
- **Use it:**

```js
import './components/zubra/theme.css';
import './components/zubra/toggle-switch.js';
```

```html
<toggle-switch label="Email me" name="email"></toggle-switch>
```

It's a standard custom element:
- in React 19, `<toggle-switch onvaluechange={…}>` in JSX;
- in Vue, Svelte and Angular, the same tag;
- in a `<form>`, it submits like an input.

**One file, no dependencies.** Most components also come as a plain custom element that needs nothing installed and no build step:

```sh
npx shadcn add https://journey-to-code-org.github.io/zubra-ui/r/element/toggle-switch.json
```

It writes the same file, compiled with Zubra's `--emit element`, and adds no dependencies; load it with a `<script type="module">`. On a page with one to three components it's the smaller choice (about 5–7 KB gzipped each); past that, the shared runtime is. flip-card (shadow DOM) and combo-box (Zag) are runtime-only.

## Why

Web components are the platform's own component model, and they work everywhere. What's missing is an ecosystem as easy as shadcn/ui: good components you can take, read and change. Zubra UI is that, for web components.

The components are written in [Zubra](https://github.com/journey-to-code-org/zubra), which compiles HTML-first `.zb` files into custom elements. You don't need Zubra to use them. If you want to edit the source, install the `.zb` file instead:

```sh
npx shadcn add https://journey-to-code-org.github.io/zubra-ui/r/src/toggle-switch.json   # writes src/components/toggle-switch.zb
```

## Theming

The theme is shadcn/ui's variables, with the same names and the same default values:
- `--primary`, `--foreground`, `--muted-foreground`, `--border`, `--card`, `--accent`, `--destructive`, `--radius` and the rest;
- light by default, and dark with `class="dark"` on `<html>`;
- `themes/system.css` follows the system's light or dark setting instead.

So:
- **In a shadcn/ui app,** the components already match: skip `theme.css`, or keep yours.
- **Any shadcn theme works,** including those from theme generators. Replace the variables and every component follows, including the ones with a shadow root, because CSS variables inherit into it.

**Themes with character, on a whole page or one section.** A theme here is more than a colour: it sets the colours for light and dark, the fonts, the corners (everything rounds from `--radius`) and the motion (`--duration-fast`, `--duration-normal`, `--duration-slow`, `--ease-out`). Five come with it: Zinc (shadcn's default), Paper, Terminal, Candy and Midnight. Each applies wherever `data-theme` is set, so one page can hold several:

```sh
npx shadcn add https://journey-to-code-org.github.io/zubra-ui/r/themes/paper.json
```

```html
<html data-theme="paper">           <!-- the whole page -->
<section data-theme="terminal">     <!-- or just this part -->
```

A theme is a JSON file in `themes/sets/` that `extends` another and lists only what differs; the build compiles it to scoped CSS. The site's Themes page shows each one on the same small app, and has an editor that makes your own and gives you its JSON and CSS.

**Motion:** every component that moves takes its timing from the theme, and stops moving for visitors who have asked their system for less motion.

## The components

35, each tested for its roles, accessible names and keyboard behaviour. They include:
- form controls: toggle switch, star rating, choice cards, colour swatches, money input, quantity stepper, tag input, date range, segmented control;
- widgets: tabs, dropdown menu, combobox (with Zag.js), tooltip, accordion, modal dialog, flip card, step indicator;
- display: line, donut and spark line charts, progress ring, streak grid, an image gallery with a lightbox, and a masonry grid;
- layout: stack, cluster, sidebar and auto grid, which adapt to their space with no media queries;
- app pieces: chat message, message composer, kanban column.
- blocks, which are components made of components: sign in, settings, pricing, and a dashboard shell. `npx shadcn add` on a block brings the components it uses.

`dist/r/registry.json` lists them all. The `legacy/` folder holds the original wcl, which these replace.

## Photos: zubra-imager

`imager/` is a separate package, `zubra-imager`, for the image gallery. It turns a folder of photos into web-ready images and a `gallery.json`:

```sh
npx zubra-imager photos/          # writes gallery/: AVIF, WebP and JPEG at 480, 960 and 1600px, and gallery.json
```

```html
<image-gallery src="gallery/gallery.json"></image-gallery>
```

- It turns each photo upright and strips its metadata, so no location or camera details are published.
- Alt text comes from `alt.json` beside the photos, then the photo's own description, then its file name.
- Each photo gets a tiny blurred placeholder, and unchanged photos are skipped next time.

## Developing

```sh
npm install
npm run build     # dist/: compiled components, plain elements, registry items, themes (and scoped themes from themes/sets/)
npm run serve     # http://127.0.0.1:4174/r/registry.json
npm test          # builds, then installs components with the real shadcn CLI into fresh projects
```

- **The tests:**
  - `npx shadcn add` into throwaway plain-HTML and React projects;
  - every page in Chromium, including contrast, axe, and phone widths;
  - every page's code built into React, Vue, Svelte, Angular and HTML apps;
  - each component's edge cases;
  - zubra-imager on photos made in the test.
- **`npm run test:element`** runs the component, site, snippet and slot tests again with every component swapped for its plain element. CI runs both.
- **`ZUBRA_UI_URL`** (or `--base-url`) sets the URL the registry items point at. The Pages workflow sets it to the published site.

ISC licence. By Mikey Nichols.
