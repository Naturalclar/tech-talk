import { renderCard } from './card.ts'
import { parseMeta } from './deck-meta.ts'

const [slug, deckDir] = process.argv.slice(2)

// The card used to be labelled with the slug, because that was the only
// argument this script got. It reads the deck's own meta.json now, so the
// listing shows the talk's real title and the date it was given.
const meta = deckDir ? parseMeta(deckDir, slug) : null

console.log(
  renderCard({
    title: meta ? meta.title : slug,
    href: `./${slug}/`,
    thumbnail: `./${slug}.png`,
    publishedAt: meta ? meta.publishedAt : null,
  })
)
