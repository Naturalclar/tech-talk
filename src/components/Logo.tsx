import React, { type CSSProperties } from 'react'

// The language and tool marks the migrated decks put on a slide. They are a
// closed set rather than a free path so a deck cannot name a file that is not
// in src/talks/assets — the images resolve against the deck's own URL, so a
// wrong name is a broken image at presentation time and nothing sooner.
const LOGOS = {
  'action-toolkit': 'logo-action-toolkit.png',
  bucklescript: 'logo-bucklescript.svg',
  flowtype: 'logo-flowtype.png',
  javascript: 'logo-javascript.png',
  ocaml: 'logo-ocaml.svg',
  react: 'logo-react.png',
  reason: 'logo-reason.png',
  'reason-long': 'logo-reason-long.svg',
  typescript: 'logo-typescript.png',
}

const Logo = ({
  name,
  size = 120,
  style = {},
}: {
  name: keyof typeof LOGOS
  size?: number
  style?: CSSProperties
}) => (
  <img
    alt={name}
    height={size}
    src={`../assets/${LOGOS[name]}`}
    style={style}
  />
)

export default Logo
