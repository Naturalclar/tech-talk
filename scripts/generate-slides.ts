import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { renderCard } from './card.ts'
import { parseMeta } from './deck-meta.ts'
import { loadExternalTalks } from './external-talks.ts'
import { fetchOgImage } from './og-image.ts'

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
  const mismatched = decks
    .map((deck) => ({ deck, meta: parseMeta(deck.dir, deck.slug) }))
    .filter(({ deck, meta }) => meta.slug !== deck.slug)
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
  await run(`pnpm exec cpx ./src/_redirects ./dist`)
  await run(`pnpm run build:css`)

  // Each deck is a vite build of the shared shell in src/deck, pointed at that
  // deck's slides. They are independent, so they run together.
  const failed: string[] = []
  await Promise.all(
    decks.map(async (deck) => {
      try {
        await run(`pnpm exec vite build`, { DECK: deck.slug })
      } catch (err) {
        console.error(`[build] ${deck.slug} failed\n${(err as Error).message}`)
        failed.push(deck.slug)
      }
    })
  )

  const built = decks.filter((deck) => failed.indexOf(deck.slug) === -1)

  // One process for every deck: it starts a single browser and serves dist/
  // once, instead of paying that cost per slide.
  await run(
    `pnpm run build:screenshot ${built.map((deck) => deck.slug).join(' ')}`
  )

  // The decks render in the browser, so their markup carries no metadata of
  // its own; it is written in here.
  await Promise.all(
    built.map((deck) =>
      run(`pnpm run --silent build:meta ${deck.slug} ${deck.dir}`)
    )
  )

  await Promise.all(
    built.map((deck) =>
      run(
        `pnpm run --silent build:oembed ${deck.slug} ${deck.dir} > ./dist/${deck.slug}/oembed.json`
      )
    )
  )

  const cards = await Promise.all(
    built.map((deck) =>
      run(`pnpm run --silent build:index ${deck.slug} ${deck.dir}`)
    )
  )

  // Talks hosted elsewhere are rendered straight from their definition —
  // there is nothing to build or serve for them. They go after the decks in
  // this repository, in the order the file lists them.
  //
  // A card still wants a thumbnail, and there is no screenshot in dist/ to
  // use. The linked page already declares one for every other link unfurler,
  // so that og:image is fetched here. An explicit thumbnail in the JSON wins:
  // it is the way to override a page whose og:image is wrong or missing.
  const talks = loadExternalTalks()
  const external = await Promise.all(
    talks.map(async (talk) =>
      renderCard({
        external: true,
        href: talk.url,
        thumbnail: talk.thumbnail || (await fetchOgImage(talk.url)),
        title: talk.title,
      })
    )
  )
  if (external.length) {
    console.log(`[index] ${external.length} external talk(s) listed`)
  }

  const template = fs.readFileSync(
    path.join(import.meta.dirname, '..', 'src', 'index.html'),
    'utf8'
  )
  fs.writeFileSync(
    path.join(import.meta.dirname, '..', 'dist', 'index.html'),
    template.replace('<!--REPLACE_ME-->', cards.concat(external).join('')),
    'utf8'
  )

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
