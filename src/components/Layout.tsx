import React, { type ReactNode } from 'react'

// The wrapper review-efficiently-with-artifact puts around every one of its
// fifteen slides.
//
// It was written in 2019 against mdx-deck and measured its heights in `vw`:
// `height: 100vw` on the container, `20vw` for a header band, `30vw` for the
// body, `20vw` for a footer band. `vw` is a width, so on the 1280x720 slide
// these render at the container came out 1024px tall and the content ran to
// 1005px — 285px below a viewport that does not scroll. The first slide's
// link was cut in half at the bottom edge, and that slide is the deck's
// og:image.
//
// The bands were two empty divs painted `aquamarine`, a named colour with no
// relation to the shared theme and nothing ever rendered inside them. They
// are gone rather than resized: at 20% each they took 288px off a 720px
// slide, and this deck's slides carry a heading, a rule and a 400px-tall
// screenshot, which does not fit in what was left. Restoring them is two
// divs if they turn out to have been deliberate.
//
// What remains is a centred column, sized to the slide rather than to the
// viewport's width, which is what the deck needed from it in the first place.
const styles = {
  container: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    justifyContent: 'center',
    maxHeight: '100%',
    width: '100%',
  },
  body: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    // Without this a flex item refuses to shrink past its content, so a tall
    // screenshot pushes the column past the slide instead of being taken down
    // to fit it.
    minHeight: 0,
    padding: '2rem',
  },
} as const

const Layout = ({ children }: { children: ReactNode }) => (
  <div style={styles.container}>
    <div style={styles.body}>{children}</div>
  </div>
)

export default Layout
