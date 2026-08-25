// A deck that steps through code shows the same block on consecutive slides
// with a different line range highlighted each time — ```ts {47-50}. That is
// what CodeSurfer used to do by scrolling and zooming to the lines in
// question; shiki only paints them, and paints them wherever they happen to
// sit in the file.
//
// For a 75-line sample only the first eighteen lines are in view, so the four
// slides built around lines 8-20, 47-50 and 57 were all showing line 1
// onwards and highlighting nothing the audience could see. Scrolling the box
// to the highlight is what makes those slides mean what they say.
//
// The alternative was cutting each sample down to the lines its slide is
// about, which changes what was presented. This does not touch the decks.

export const centreOnHighlight = (pre: HTMLPreElement): void => {
  if (pre.scrollHeight <= pre.clientHeight) return

  const lines = pre.querySelectorAll<HTMLElement>('code .line.highlighted')
  if (!lines.length) {
    // A step with no highlight is the whole file: start at the top rather
    // than wherever the previous slide happened to leave it.
    pre.scrollTop = 0
    return
  }

  const box = pre.getBoundingClientRect()
  const first = lines[0].getBoundingClientRect()
  const last = lines[lines.length - 1].getBoundingClientRect()

  // A range taller than the box cannot be centred, so show it from its first
  // line — the end of a long block is never the part being introduced.
  pre.scrollTop +=
    last.bottom - first.top > pre.clientHeight
      ? first.top - box.top
      : (first.top + last.bottom) / 2 - (box.top + pre.clientHeight / 2)
}

// remdx swaps slides itself, so there is no event to listen for. Watching the
// tree it renders into covers every way a slide can change — keyboard, click,
// or the deck restoring a slide from the URL.
export const scrollToHighlight = (root: HTMLElement): void => {
  const run = () =>
    requestAnimationFrame(() => {
      root.querySelectorAll<HTMLPreElement>('pre').forEach(centreOnHighlight)
    })

  new MutationObserver(run).observe(root, { childList: true, subtree: true })
  run()
}
