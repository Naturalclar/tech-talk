import React, { type ReactNode } from 'react'

const styles = {
  container: {
    display: 'flex',
    height: '100%',
    width: '100%',
  },
} as const

const Page = ({ children }: { children: ReactNode }) => (
  <div style={styles.container}>{children}</div>
)
export default Page
