// ---- motion polyfill: what `animate` does in @zubra/compiler from journey-to-code-org/zubra#116,
// done from outside until that release is on npm (polyfill/README.md says how to remove it).
// Elements removed from `container` come back with data-leaving and inert, and go once the
// transitions and animations that starts have ended (infinite ones aren't waited for). With
// `glides`, removed elements leave held in place out of the flow, and the rest glide to their new
// places (--zb-move-duration, --zb-move-easing). Under reduced motion, none of it. `container`
// must be positioned when it glides. Returns a cleanup, for onMount.
function presence(container, glides = false) {
  const reduced = () => !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  const leaving = new WeakSet()
  let places = new Map()
  // Where an element is laid out in the (positioned) container: offsets, which a glide's transform
  // doesn't change, so one change can interrupt another.
  const where = (node) => ({ x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight })
  // What each element looks like now (what its transitions animate, and its animation), so one
  // that's put back after being removed starts leaving from there rather than as if new.
  const looks = (node) => {
    const style = getComputedStyle(node)
    const names = style.transitionProperty.split(",").map((name) => name.trim())
    const animated = names.includes("all") ? ["opacity", "transform", "translate", "scale", "rotate", "filter", "clip-path"] : names.filter((name) => name !== "none")
    return { values: animated.map((name) => [name, style.getPropertyValue(name)]), animation: style.animationName }
  }
  const sizes = new ResizeObserver(() => snapshot())
  const snapshot = () => {
    places = new Map()
    for (const child of container.children) {
      if (leaving.has(child)) continue
      places.set(child, { ...where(child), ...looks(child) })
      sizes.observe(child)
    }
  }
  const leave = (node, place) => {
    leaving.add(node)
    node.inert = true
    if (glides && place) Object.assign(node.style, { position: "absolute", top: `${place.y}px`, left: `${place.x}px`, width: `${place.width}px`, height: `${place.height}px`, margin: "0" })
    if (!place) node.setAttribute("data-leaving", "")
    else {
      // Back as it was (held there, above any animation), then let go into data-leaving. Its own
      // animation doesn't play again; one that data-leaving starts does.
      node.style.setProperty("transition", "none")
      node.style.setProperty("animation", "none")
      for (const [name, value] of place.values) node.style.setProperty(name, value, "important")
      node.setAttribute("data-leaving", "")
      getComputedStyle(node).opacity
      for (const [name] of place.values) node.style.removeProperty(name)
      node.style.removeProperty("transition")
      getComputedStyle(node).opacity // the transitions start here, before any animation can stop them
      node.style.removeProperty("animation")
      if (getComputedStyle(node).animationName === place.animation) node.style.setProperty("animation", "none")
    }
    // getAnimations() brings styles up to date, so it sees what data-leaving started.
    const running = node.getAnimations({ subtree: true }).filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity && animation.playState !== "finished")
    if (!running.length) node.remove()
    else Promise.allSettled(running.map((animation) => animation.finished)).then(() => node.remove())
  }
  const changes = new MutationObserver((records) => {
    if (reduced()) return snapshot()
    // Each removed element goes back where it was: after what was before it (or what went back
    // there already), so several in a row keep their order.
    const after = new Map()
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (node.nodeType !== 1 || leaving.has(node) || node.isConnected) continue
        const before = after.get(record.previousSibling) ?? record.previousSibling
        if (before?.parentNode === container) before.after(node)
        else if (record.nextSibling?.parentNode === container) record.nextSibling.before(node)
        else container.prepend(node)
        after.set(record.previousSibling, node)
        leave(node, places.get(node))
      }
    }
    if (glides) {
      for (const [node, was] of places) {
        if (leaving.has(node) || node.parentNode !== container) continue
        const now = where(node)
        const x = was.x - now.x
        const y = was.y - now.y
        if (!x && !y) continue
        const style = getComputedStyle(node)
        const time = /^\s*([\d.]+)(ms|s)\s*$/.exec(style.getPropertyValue("--zb-move-duration"))
        const ms = time ? Number(time[1]) * (time[2] === "s" ? 1000 : 1) : 250
        if (ms) node.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }], { duration: ms, easing: style.getPropertyValue("--zb-move-easing").trim() || "cubic-bezier(0.2, 0, 0, 1)", composite: "add" })
      }
    }
    snapshot()
  })
  changes.observe(container, { childList: true })
  sizes.observe(container)
  // Seen again once an entrance (or any animation) settles, so the look kept isn't halfway through it.
  container.addEventListener("animationend", snapshot)
  container.addEventListener("transitionend", snapshot)
  snapshot()
  return () => {
    changes.disconnect()
    sizes.disconnect()
    container.removeEventListener("animationend", snapshot)
    container.removeEventListener("transitionend", snapshot)
  }
}
// ---- end of the motion polyfill
