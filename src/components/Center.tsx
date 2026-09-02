import React, { type ReactNode } from 'react'

// Sized to the slide, not the viewport. `100vw` ignores the slide's own
// padding and comes out 9px wider than the slide holding it — the third
// component here to have that exact bug, after Layout and Page — and the
// fit-to-slide pass was quietly scaling the three slides that use this by
// 0.992 to cover for it.
const Center = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      justifyContent: 'center',
      width: '100%',
    }}
  >
    {children}
  </div>
)

export default Center
