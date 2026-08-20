import fs from 'fs'
import path from 'path'
import { escapeAttr, escapeText } from './escape.ts'
import { parseMeta } from './deck-meta.ts'
import { SITE_URL } from './site.ts'

// A built deck is a shell: vite emits the slides as JavaScript and nothing is
// pre-rendered, so the markup carries no title, no OG image and no oEmbed
// link of its own. Anything that does not run JavaScript — every crawler and
// every link unfurler — would see an empty page. The tags are written in
// here, from meta.json, rather than rendered by the deck.

const main = () => {
  const [slug, deckDir] = process.argv.slice(2)
  if (!slug || !deckDir) {
    console.log('usage: ./generate-meta [slug] [deck-dir]')
    process.exitCode = 1
    return
  }

  const htmlPath = path.join(
    import.meta.dirname,
    '..',
    'dist',
    slug,
    'index.html'
  )
  if (!fs.existsSync(htmlPath)) {
    console.log(`[meta] ${slug}: no index.html, skipped`)
    return
  }

  const html = fs.readFileSync(htmlPath, 'utf8')
  // Nothing writes these tags but this script, so finding them means it has
  // already run over this file — during a rebuild that skipped the vite step,
  // say. Injecting a second copy of everything would be worse than stopping.
  if (html.indexOf('og:image') !== -1) return

  const meta = parseMeta(deckDir, slug)
  const title = escapeAttr(meta.title)
  const description = escapeAttr(meta.description)

  const tags = [
    `<meta name="twitter:description" content="${description}"/>`,
    `<meta property="og:description" content="${description}"/>`,
    `<meta property="og:locale" content="ja_JP"/>`,
    `<meta property="og:title" content="${title}"/>`,
    `<meta property="og:type" content="article"/>`,
    `<meta property="og:url" content="${SITE_URL}/${meta.slug}/"/>`,
    `<meta property="og:image" content="${SITE_URL}/${meta.slug}.png"/>`,
    `<meta property="article:author" content="naturalclar"/>`,
    `<meta name="twitter:card" content="summary"/>`,
    `<meta name="twitter:title" content="${title}"/>`,
    `<meta name="twitter:image" content="${SITE_URL}/${meta.slug}.png"/>`,
    `<link rel="alternate" type="application/json+oembed" href="${SITE_URL}/${meta.slug}/oembed.json" title="${title}"/>`,
  ]

  if (meta.publishedAt) {
    tags.push(
      `<meta property="article:published_time" content="${new Date(
        meta.publishedAt
      ).toISOString()}"/>`
    )
  }

  // The deck's own markup has no <title> — vite builds a shell and the slides
  // arrive as JavaScript — so one is added rather than replaced. Replacing is
  // still handled in case a shell ever ships with a placeholder.
  const escapedTitle = `<title>${escapeText(meta.title)}</title>`
  const titled = /<title>/.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/, escapedTitle)
    : html
  if (!/<title>/.test(html)) {
    tags.unshift(escapedTitle)
  }

  const injected = titled.replace('</head>', `${tags.join('\n')}\n</head>`)

  fs.writeFileSync(htmlPath, injected, 'utf8')
  console.log(`[meta] ${slug}: injected`)
}

main()
