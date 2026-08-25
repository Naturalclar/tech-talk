import React, { type ReactNode } from 'react'

// A slide's contents are centred by default. Decks that carry a <Header> want
// the body ranged left underneath it instead.
const AlignLeft = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      alignItems: 'flex-start',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    {children}
  </div>
)

export default AlignLeft
