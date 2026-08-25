import React from 'react'
import Avatar from './Avatar'

// The self-introduction slide every deck migrated from the talks monorepo
// opens with. It was one shared component there too, which is why decks given
// years apart all name the same employer: the component was edited in place
// whenever it changed, and the older decks were re-rendered with the new text.
// That is carried over as-is rather than guessed at per deck.
//
// The rules above and below were `white` there, where the decks rendered on
// code-surfer's dracula theme. These render on the shared light theme, so the
// colour follows the text instead of being pinned to one of the two.
const styles = {
  company: {
    fontSize: 30,
    marginBottom: '24px',
  },
  content: {
    alignItems: 'center',
    display: 'flex',
  },
  line: {
    backgroundColor: 'currentColor',
    height: 2,
    width: '100%',
  },
  list: {
    listStyleType: 'none',
  },
  listItemSub: {
    fontSize: 20,
    marginBottom: '8px',
  },
  name: {
    fontSize: 36,
    fontWeight: 700,
  },
} as const

const Profile = () => (
  <div>
    <div style={styles.line} />
    <div style={styles.content}>
      <Avatar />
      <ul style={styles.list}>
        <li style={styles.name}>Jesse Katsumata</li>
        <li style={styles.company}>Engineer at stand.fm</li>
        <li style={styles.listItemSub}>Member of:</li>
        <li style={styles.listItemSub}>- React Native Community</li>
        <li style={{ ...styles.listItemSub, marginBottom: 24 }}>
          - React Native JP
        </li>
        <li style={styles.listItemSub}>
          <a href="https://twitter.com/natural_clar">Twitter: @natural_clar</a>
        </li>
        <li style={styles.listItemSub}>
          <a href="https://github.com/Naturalclar">Github: @Naturalclar</a>
        </li>
      </ul>
    </div>
    <div style={styles.line} />
  </div>
)

export default Profile
