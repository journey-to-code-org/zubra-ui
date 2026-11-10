# Motion polyfill (temporary)

`presence.js` does, from outside a component, what `animate` does inside one in
[journey-to-code-org/zubra#116](https://github.com/journey-to-code-org/zubra/pull/116): an element removed
from a container stays with `data-leaving` and `inert` until its exit transition ends, and with
`glides`, the rest glide to their new places. Same attribute, same `--zb-move-duration` and
`--zb-move-easing`, same reduced-motion rule, so each component's CSS doesn't change when the
polyfill goes.

It's here because Zubra UI builds with the published `@zubra/compiler`, which doesn't know
`animate` yet. Components that need it paste the function between its two marker comments, so
every output (the module, the plain element, the CDN file, the `.zb` source item) stays one
self-contained file. `test/motion.test.js` checks that every pasted copy matches this file.

## Removing it, once a release with `animate` is on npm

1. `npm install -D @zubra/compiler@^<that release> @zubra/runtime@^<that release>`.
2. In each component that pastes the polyfill (`grep -l "motion polyfill" components/*.zb`):
   - delete the block and the `onMount(() => presence(…))` line (and `onMount` from the import if nothing else uses it);
   - put `animate` on the `<zb-each>` (or `<zb-if>` / `<zb-switch>`, or `zb-animate` beside `zb-if={…}`) that was inside the container, and drop the container's `ref` if only the polyfill used it.
3. Delete this folder, and the "pasted copies match" test in `test/motion.test.js`. The behaviour tests there stay: they hold the same behaviour without the polyfill.
