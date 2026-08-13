#!/usr/bin/env ts-node

import fs from 'fs'
import path from 'path'
import { parseMeta } from './deck-meta'
import { SITE_URL } from './site'

// Decks using <CodeSurfer> cannot be server rendered — the component reads
// mdx-deck's deck context, which is null under renderToString — so those decks
// are built with --no-html and their static markup contains no <Head> output
// at all. Crawlers see no title, no OG image and no oEmbed link, which is
// every deck that shows code. Writing the tags here instead of relying on the
// render means metadata no longer depends on whether SSR happened to work.

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const main = () => {
  const [slug, mdxPath] = process.argv.slice(2)
  if (!slug || !mdxPath) {
    console.log('usage: ./generate-meta [slug] [mdx-path]')
    process.exitCode = 1
    return
  }

  const htmlPath = path.join(__dirname, '..', 'dist', slug, 'index.html')
  if (!fs.existsSync(htmlPath)) {
    console.log(`[meta] ${slug}: no index.html, skipped`)
    return
  }

  const html = fs.readFileSync(htmlPath, 'utf8')
  // A server rendered deck already carries these tags; leave it alone rather
  // than emitting a second copy of everything.
  if (html.indexOf('og:image') !== -1) return

  const meta = parseMeta(mdxPath, slug)
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

  // The fallback markup ships a placeholder title of "mdx-deck".
  const titled = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${title}</title>`
  )
  const injected = titled.replace('</head>', `${tags.join('\n')}\n</head>`)

  fs.writeFileSync(htmlPath, injected, 'utf8')
  console.log(`[meta] ${slug}: injected`)
}

main()
