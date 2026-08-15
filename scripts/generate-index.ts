#!/usr/bin/env ts-node

import { renderCard } from './card'
import { parseMeta } from './deck-meta'

const [slug, deckDir] = process.argv.slice(2)

// The card used to be labelled with the slug, because that was the only
// argument this script got. It reads the deck's own <Meta title> now, so the
// listing shows the talk's real title rather than its folder name.
const title = deckDir ? parseMeta(deckDir, slug).title : slug

console.log(
  renderCard({
    title,
    href: `./${slug}/`,
    thumbnail: `./${slug}.png`,
  })
)
