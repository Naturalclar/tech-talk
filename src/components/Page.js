import React from 'react'

const styles = {
  container: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
  },
}

const Page = ({ children }) => <div style={styles.container}>{children}</div>
export default Page
