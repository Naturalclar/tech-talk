import React, { type ReactNode } from 'react'

const Center = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      justifyContent: 'center',
      width: '100vw',
    }}
  >
    {children}
  </div>
)

export default Center
