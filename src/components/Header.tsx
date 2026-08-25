import React, { type ReactNode } from 'react'

// A banner pinned to the top of the slide, carrying the section the slide
// belongs to. Used by the decks given in 2021 and 2022, which run a running
// header rather than a heading per slide.
const Header = ({ children }: { children: ReactNode }) => (
  <header
    style={{
      alignItems: 'center',
      background: 'linear-gradient(135.73deg, #6346d7 1.23%, #f33682 100%)',
      display: 'flex',
      height: 80,
      left: 0,
      paddingLeft: 24,
      position: 'absolute',
      right: 0,
      top: 0,
    }}
  >
    <h3 style={{ color: 'white' }}>{children}</h3>
  </header>
)

export default Header
