import React from 'react'

const styles = {
  container: {
    width: '100vw',
    height: '100vw',
    display: 'flex',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    flexDirection: 'column',
  },
  header: {
    height: `20vw`,
    alignSelf: 'stretch',
    backgroundColor: 'aquamarine',
  },
  body: {
    height: '30vw',
    padding: '5vw',
    justifyContent: 'center',
    display: 'flex',
    alignSelf: 'stretch',
    flexDirection: 'column',
  },
  footer: {
    height: `20vw`,
    alignSelf: 'stretch',
    backgroundColor: 'aquamarine',
  },
}

const Layout = ({ children }) => (
  <div style={styles.container}>
    <div style={styles.header} />
    <div style={styles.body}>{children}</div>
    <div style={styles.footer} />
  </div>
)

export default Layout
