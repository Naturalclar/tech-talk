import fs from 'fs'
import os from 'os'
import path from 'path'
import { exec } from 'child_process'
import { createHash } from 'crypto'
import { renderCard } from './card.ts'
import { parseMeta } from './deck-meta.ts'
import { loadExternalTalks } from './external-talks.ts'
import { fetchOgImage } from './og-image.ts'
import { escapeAttr, escapeText } from './escape.ts'
import { byNewest } from './published-at.ts'
import { SITE_DESCRIPTION, SITE_IMAGE, SITE_TITLE, SITE_URL } from './site.ts'
import { renderRobots, renderSitemap } from './sitemap.ts'

const run = (cmd: string, env?: NodeJS.ProcessEnv): Promise<string> =>
  new Promise((resolve, reject) => {
    exec(
      cmd,
      { env: { ...process.env, ...env }, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`${cmd}\n${stderr}`))
          return
        }
        resolve(stdout)
      }
    )
  })

// How many of the per-deck commands run at once.
//
// `Promise.all` over the deck list started all thirty at the same time, and
// under that much load the build stopped being reproducible: shiki's *dark*
// theme quietly fell back to a flat #919191 for whole code blocks — the
// light theme was always fine — so which decks lost their syntax colours
// changed from run to run. Three runs at thirty gave three different sites;
// three runs bounded gave one, byte for byte, with ten more tokens keeping
// their colour.
//
// It was not buying anything either: thirty at once took 28s against 21s
// bounded, on the four cores a GitHub runner also has.
//
// The cap matters as much as the floor. A machine with more cores than there
// are decks would otherwise be back to starting all of them at once, which
// is the case that misbehaves.
const CONCURRENCY = Math.min(Math.max(os.cpus().length, 2), 8)

const mapWithLimit = async <T, R>(
  items: readonly T[],
  work: (item: T) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let next = 0

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await work(items[index])
      }
    })
  )

  return results
}

// The listing's own <head>. Every deck gets this written in by
// generate-meta.ts from its meta.json; the page that links them all had a
// placeholder <title> and nothing else, so sharing the site produced an
// untitled link with no image.
const siteMeta = (): string =>
  [
    `<title>${escapeText(SITE_TITLE)}</title>`,
    `<meta name="description" content="${escapeAttr(SITE_DESCRIPTION)}"/>`,
    `<link rel="canonical" href="${SITE_URL}/"/>`,
    `<meta property="og:type" content="website"/>`,
    `<meta property="og:locale" content="ja_JP"/>`,
    `<meta property="og:site_name" content="${escapeAttr(SITE_TITLE)}"/>`,
    `<meta property="og:title" content="${escapeAttr(SITE_TITLE)}"/>`,
    `<meta property="og:description" content="${escapeAttr(SITE_DESCRIPTION)}"/>`,
    `<meta property="og:url" content="${SITE_URL}/"/>`,
    `<meta property="og:image" content="${SITE_IMAGE}"/>`,
    // The screenshot is 1280x720, which is what summary_large_image wants.
    `<meta name="twitter:card" content="summary_large_image"/>`,
    `<meta name="twitter:title" content="${escapeAttr(SITE_TITLE)}"/>`,
    `<meta name="twitter:description" content="${escapeAttr(SITE_DESCRIPTION)}"/>`,
    `<meta name="twitter:image" content="${SITE_IMAGE}"/>`,
  ].join('\n    ')

// The decks' assets are content-hashed by vite; the landing page's stylesheet
// was not, so a returning visitor kept the old one until their cache expired.
// That bit during development more than once — a deploy that looked like it
// had not happened — and it bites visitors the same way every time a talk is
// added. Renaming the file after Tailwind writes it makes the address change
// whenever the bytes do.
//
// dist/index.html itself cannot carry a hash, and its caching is GitHub
// Pages' to decide. Pinning the stylesheet at least rules out new markup
// being styled by an old sheet.
const fingerprintStylesheet = (dist: string): string => {
  const built = path.join(dist, 'index.css')
  const hash = createHash('sha256')
    .update(fs.readFileSync(built))
    .digest('hex')
    .slice(0, 8)

  const name = `index-${hash}.css`
  fs.renameSync(built, path.join(dist, name))
  return `<link rel="stylesheet" href="./${name}" />`
}

// A deck is a directory under src/talks holding slides.re.mdx and meta.json.
const listDecks = (dir: string): string[] =>
  fs
    .readdirSync(dir)
    .filter((name) => fs.existsSync(path.join(dir, name, 'slides.re.mdx')))
    .sort()

const main = async () => {
  if (process.argv.length < 3) {
    console.log('usage: ./generate-slides [dirname]')
    return
  }

  const dirname = process.argv[2]
  const decks = listDecks(dirname).map((slug) => ({
    dir: path.join(dirname, slug),
    slug,
  }))

  // The folder name is the slug the build writes everything under, while the
  // deck declares its own copy for the metadata to render URLs from. Nothing
  // keeps the two in step, and a mismatch is invisible: the deck builds, and
  // only the OG image, oEmbed link and canonical URL end up pointing at files
  // that were never written. Refuse to build instead.
  const described = decks.map((deck) => ({
    deck,
    meta: parseMeta(deck.dir, deck.slug),
  }))

  const metaFor = (slug: string) =>
    described.find(({ deck }) => deck.slug === slug)!.meta

  const mismatched = described.filter(
    ({ deck, meta }) => meta.slug !== deck.slug
  )
  if (mismatched.length) {
    mismatched.forEach(({ deck, meta }) => {
      console.error(
        `[meta] ${deck.dir}/meta.json: slug "${meta.slug}" does not match folder "${deck.slug}"`
      )
    })
    process.exitCode = 1
    return
  }

  await run(`pnpm exec rimraf ./dist`)

  // Assets go in before the screenshots: decks reference shared images as
  // plain ../assets/* paths, which only resolve once dist/assets exists.
  await run(`pnpm run build:assets`)
  await run(`pnpm run build:css`)

  // Each deck is a vite build of the shared shell in src/deck, pointed at that
  // deck's slides. They are independent, so they run together — CONCURRENCY at
  // a time rather than all of them, for the reason recorded above it.
  const failed: string[] = []
  await mapWithLimit(decks, async (deck) => {
    try {
      await run(`pnpm exec vite build`, { DECK: deck.slug })
    } catch (err) {
      console.error(`[build] ${deck.slug} failed\n${(err as Error).message}`)
      failed.push(deck.slug)
    }
  })

  const built = decks.filter((deck) => failed.indexOf(deck.slug) === -1)

  // One process for every deck: it starts a single browser and serves dist/
  // once, instead of paying that cost per slide.
  await run(
    `pnpm run build:screenshot ${built.map((deck) => deck.slug).join(' ')}`
  )

  // The decks render in the browser, so their markup carries no metadata of
  // its own; it is written in here.
  await mapWithLimit(built, (deck) =>
    run(`pnpm run --silent build:meta ${deck.slug} ${deck.dir}`)
  )

  await mapWithLimit(built, (deck) =>
    run(
      `pnpm run --silent build:oembed ${deck.slug} ${deck.dir} > ./dist/${deck.slug}/oembed.json`
    )
  )

  const deckCards = await mapWithLimit(built, async (deck) => ({
    html: await run(`pnpm run --silent build:index ${deck.slug} ${deck.dir}`),
    publishedAt: metaFor(deck.slug).publishedAt,
  }))

  // Talks hosted elsewhere are rendered straight from their definition —
  // there is nothing to build or serve for them.
  //
  // A card still wants a thumbnail, and there is no screenshot in dist/ to
  // use. The linked page already declares one for every other link unfurler,
  // so that og:image is fetched here. An explicit thumbnail in the JSON wins:
  // it is the way to override a page whose og:image is wrong or missing.
  const talks = loadExternalTalks()
  const externalCards = await Promise.all(
    talks.map(async (talk) => ({
      html: renderCard({
        external: true,
        href: talk.url,
        publishedAt: talk.publishedAt || null,
        thumbnail: talk.thumbnail || (await fetchOgImage(talk.url)),
        title: talk.title,
      }),
      publishedAt: talk.publishedAt || null,
    }))
  )
  if (externalCards.length) {
    console.log(`[index] ${externalCards.length} external talk(s) listed`)
  }

  // The two kinds are interleaved by date rather than kept in separate
  // blocks: the cards show when each talk was given, and a listing that
  // shows dates in any other order reads as unsorted. Where a talk is
  // hosted is not something a visitor is ordering by.
  const listed = byNewest(deckCards.concat(externalCards))
  const cards = listed.map((card) => card.html)

  const template = fs.readFileSync(
    path.join(import.meta.dirname, '..', 'src', 'index.html'),
    'utf8'
  )
  const dist = path.join(import.meta.dirname, '..', 'dist')
  fs.writeFileSync(
    path.join(dist, 'index.html'),
    template
      .replace('<!--REPLACE_STYLESHEET-->', fingerprintStylesheet(dist))
      .replace('<!--REPLACE_META-->', siteMeta())
      .replace('<!--REPLACE_ME-->', cards.join('')),
    'utf8'
  )

  // Nothing links to a deck except the landing page, and the decks link
  // nowhere at all — they render in the browser, so a crawler that does not
  // run scripts sees an empty shell. A sitemap is the only thing telling one
  // that the eight deck URLs exist.
  //
  // lastmod is the date the talk was given, not the date of the build. It is
  // the closest thing to "when this page's content changed", and it does not
  // move every deploy, which a build timestamp would — telling crawlers the
  // whole site changed daily when nothing did.
  const entries = [
    { lastmod: listed[0] ? listed[0].publishedAt : null, path: '/' },
    ...byNewest(
      built.map((deck) => ({
        lastmod: metaFor(deck.slug).publishedAt,
        path: `/${deck.slug}/`,
        publishedAt: metaFor(deck.slug).publishedAt,
      }))
    ),
  ]
  fs.writeFileSync(path.join(dist, 'sitemap.xml'), renderSitemap(entries))
  fs.writeFileSync(path.join(dist, 'robots.txt'), renderRobots())
  console.log(`[sitemap] ${entries.length} url(s)`)

  // The landing page's og:image is a screenshot of the landing page, so it
  // can only be taken now that the page exists. That is a second browser
  // launch, which is why it is not folded into stage 3.
  try {
    await run(`pnpm run build:screenshot .`)
  } catch (err) {
    // A missing og:image is a worse card, not a broken site.
    console.error(`[screenshot] index failed\n${(err as Error).message}`)
    process.exitCode = 1
  }

  if (failed.length) {
    console.error(
      `[build] ${failed.length} deck(s) failed: ${failed.join(', ')}`
    )
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
