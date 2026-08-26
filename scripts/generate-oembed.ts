import { parseMeta } from './deck-meta.ts'
import { SITE_URL } from './site.ts'

const [slug, deckDir] = process.argv.slice(2)

// The title used to be left empty, so consumers that expanded a link had
// nothing to label it with. It comes from the deck's meta.json now.
const title = deckDir ? parseMeta(deckDir, slug).title : ''

const oEmbed = {
  type: 'rich',
  version: '1.0',
  provider_name: 'slides.naturalclar.dev',
  provider_url: SITE_URL,
  title,
  width: 658,
  height: 408,
  html: `<iframe style="width: 100%; overflow: hidden;" src="${SITE_URL}/${slug}/index.html" width="658" height="408" frameborder="0" scrolling="no" ></iframe>`,
}

console.log(JSON.stringify(oEmbed))
