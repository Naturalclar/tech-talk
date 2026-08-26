// A slide does not scroll, so anything taller than it is simply unreachable —
// during the talk and afterwards. Seventeen slides across eleven decks were in
// that state: `ncdu.png` ended 233px below the bottom of the slide it is the
// subject of, and four other screenshots and a link were cut in half at the
// edge.
//
// Every one of those decks was written under CodeSurfer, which scaled what it
// was given down until it fit. That is what went missing in the ReMDX
// migration, and it is what this restores: the slide's content is measured,
// and if it does not fit it is scaled — heading, prose and screenshot
// together, in proportion — until it does. The seventeen need 0.727 to 0.992,
// so the worst affected loses a quarter of its size and most lose under a
// tenth. Every other slide in every deck is left alone: a slide that already
// fits is measured, found to fit, and never touched.
//
// Shrinking the image alone was tried first and is worse than the bug. A flex
// item given `min-height: 0` gives up height without giving up width, so
// `object-fit: contain` then letterboxes the picture inside a box the wrong
// shape: `ncdu.png` came out 279x137 in a 1280px slide. A terminal capture
// nobody can read is not an improvement on one that is cut off.

// The element remdx scales the whole deck with. Its children are the slides,
// which is the same fact `CodeSteps` counts on to work out which slide it is
// sitting on.
const slidesIn = (root: HTMLElement): HTMLElement[] => {
  const container = root.querySelector(':scope > div > div')
  return container ? (Array.from(container.children) as HTMLElement[]) : []
}

// The box the slide's content actually occupies, in client coordinates.
//
// Two things are deliberately left out. An absolutely positioned element is
// out of the flow — a deck's watermark is parked behind the text at 900px and
// would drag every slide it is on down to a quarter size. And a box that
// scrolls its own content keeps that content reachable, so what is inside one
// is not overflow: a 75-line code sample sits in a `pre` capped at 60vh, and
// measuring through it would scale the slide to fit a file nobody is being
// shown all of.
const contentBounds = (
  column: HTMLElement
): { bottom: number; left: number; right: number; top: number } | null => {
  let bottom = -Infinity
  let left = Infinity
  let right = -Infinity
  let top = Infinity

  const walk = (parent: Element): void => {
    for (const child of Array.from(parent.children)) {
      const style = getComputedStyle(child)
      if (style.position === 'absolute' || style.position === 'fixed') {
        continue
      }

      const rect = child.getBoundingClientRect()
      if (rect.width || rect.height) {
        bottom = Math.max(bottom, rect.bottom)
        left = Math.min(left, rect.left)
        right = Math.max(right, rect.right)
        top = Math.min(top, rect.top)
      }

      if (!/auto|scroll/.test(style.overflowX + style.overflowY)) {
        walk(child)
      }
    }
  }

  walk(column)
  return top === Infinity ? null : { bottom, left, right, top }
}

const fit = (slide: HTMLElement): void => {
  const column = slide.firstElementChild
    ?.firstElementChild as HTMLElement | null
  // remdx keeps every slide in the tree and hides the ones it is not showing,
  // so most of them measure zero and there is nothing to fit yet.
  if (!column || !column.offsetWidth || !column.offsetHeight) {
    return
  }

  // Measure undistorted: a scale left over from the last run would be read
  // back as content that already fits.
  column.style.transform = ''

  const box = column.getBoundingClientRect()
  const content = contentBounds(column)
  if (!content) {
    return
  }

  // remdx scales the deck as a whole, so client coordinates are not the units
  // a transform on this element is written in. offsetWidth is the layout
  // width, before any of that, and the ratio between the two converts.
  const ratio = box.width / column.offsetWidth || 1

  // The space to fit into is the slide, not the column. remdx lays the column
  // out 51px wider than the slide holding it — a width and 48px of padding
  // that do not add up to what contains them — and the slide clips the
  // difference: on `creating-your-own-github-actions` that took the end off a
  // line of GraphQL, in a `pre` with no scrollbar to reach it with, because
  // the block fits its own box and it is the box that is off the screen.
  // Measuring against the column would call that a slide that fits.
  //
  // The two share an origin, so the column's own padding is what keeps the
  // content off the edges.
  const style = getComputedStyle(column)
  const padLeft = parseFloat(style.paddingLeft) || 0
  const padTop = parseFloat(style.paddingTop) || 0
  const availableWidth =
    slide.clientWidth - padLeft - (parseFloat(style.paddingRight) || 0)
  const availableHeight =
    slide.clientHeight - padTop - (parseFloat(style.paddingBottom) || 0)

  const width = (content.right - content.left) / ratio
  const height = (content.bottom - content.top) / ratio
  if (width <= 0 || height <= 0) {
    return
  }

  const scale = Math.min(1, availableWidth / width, availableHeight / height)
  // Under a pixel of overflow is a rounding artefact, not something an
  // audience can see, and scaling for it would blur a slide that is fine.
  if (scale > 0.995) {
    return
  }

  // Scale about the column's own origin, then put the scaled content back in
  // the middle of the space it has. Centring it is what the slide did before:
  // taking the scale about the box's centre instead leaves content that was
  // never centred in the box still hanging out of the bottom.
  const offsetLeft = (content.left - box.left) / ratio
  const offsetTop = (content.top - box.top) / ratio
  const x = padLeft + (availableWidth - width * scale) / 2 - offsetLeft * scale
  const y = padTop + (availableHeight - height * scale) / 2 - offsetTop * scale

  column.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  column.style.transformOrigin = '0 0'
}

// remdx swaps slides itself, so there is no event to listen for — the same
// reason scroll-to-highlight.ts watches the tree rather than the deck.
//
// The observer is childList only. Writing the transform is an attribute
// change, and watching attributes as well would have every fit trigger the
// next one.
export const fitToSlide = (root: HTMLElement): void => {
  const run = () => requestAnimationFrame(() => slidesIn(root).forEach(fit))

  new MutationObserver(run).observe(root, { childList: true, subtree: true })

  // An image with no dimensions on it is zero high until it arrives, so the
  // slide measures as fitting and is measured again when it does not. `load`
  // does not bubble, hence the capture phase.
  root.addEventListener('load', run, true)
  window.addEventListener('resize', run)
  document.fonts?.ready.then(run)

  run()
}
