#!/usr/bin/env ts-node

import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'
import { renderCard } from './card'
import { parseMeta } from './deck-meta'
import { loadExternalTalks } from './external-talks'

const run = (cmd: string): Promise<string> =>
  new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 32 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd}\n${stderr}`))
        return
      }
      resolve(stdout)
    })
  })

// recursively get files of given path
const listDir = (dir: string, list: string[] = []): string[] => {
  let fileList = list
  const files = fs.readdirSync(dir)
  files.forEach((file) => {
    const dirPath = path.join(dir, file)
    if (fs.statSync(dirPath).isDirectory()) {
      fileList = listDir(dirPath, fileList)
    } else {
      fileList = fileList.concat(dirPath)
    }
  })
  return fileList
}

// get the name of folder that contains given dirpath
const getTitle = (dir: string): string => {
  return path.basename(path.dirname(dir))
}

// Some decks fail mdx-deck's static html generation, so they are rebuilt
// without it. The retry wipes the output directory first, which is why
// nothing else may write into dist/<slug> until this has finished.
const buildDeck = async (mdx: string, slug: string): Promise<void> => {
  try {
    await run(`pnpm run build:mdx ${mdx} --out-dir ./dist/${slug}`)
  } catch {
    // The error itself is not worth printing: every deck that lands here does
    // so for a reason we already know about, and the stack is a wall of
    // webpack frames. Which decks fell back is the useful part.
    console.log(`[build] ${slug}: static html failed, retrying with --no-html`)
    await run(`pnpm exec rimraf ./dist/${slug}`)
    await run(`pnpm run build:mdx --no-html ${mdx} --out-dir ./dist/${slug}`)
  }
}

const main = async () => {
  if (process.argv.length < 3) {
    console.log('usage: ./generate-slides [dirname]')
    return
  }

  const dirname = process.argv[2]

  // filter files that ends with .mdx
  const decks = listDir(dirname)
    .filter((file) => path.extname(file) === '.mdx')
    .map((mdx) => ({ mdx, slug: getTitle(mdx) }))

  // The folder name is the slug the build writes everything under, while the
  // deck declares its own copy for <Meta> to render URLs from. Nothing keeps
  // the two in step, and a mismatch is invisible: the deck builds, and only
  // the OG image, oEmbed link and canonical URL end up pointing at files that
  // were never written. Refuse to build instead.
  const mismatched = decks
    .map((deck) => ({ deck, meta: parseMeta(deck.mdx, deck.slug) }))
    .filter(({ deck, meta }) => meta.declaredSlug !== deck.slug)
  if (mismatched.length) {
    mismatched.forEach(({ deck, meta }) => {
      console.error(
        meta.declaredSlug === null
          ? `[meta] ${deck.mdx}: <Meta> has no slug prop (expected "${deck.slug}")`
          : `[meta] ${deck.mdx}: slug "${meta.declaredSlug}" does not match folder "${deck.slug}"`
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
  // The landing page's stylesheet. Tailwind scans the sources for the classes
  // actually used, so this has to run after any change to index.html or the
  // card template — which is every build, since dist/ is wiped above.
  await run(`pnpm run build:css`)

  const failed: string[] = []
  await Promise.all(
    decks.map(async (deck) => {
      try {
        await buildDeck(deck.mdx, deck.slug)
      } catch (err) {
        console.error(`[build] ${deck.slug} failed\n${err.message}`)
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

  // Decks that fell back to --no-html have no metadata in their markup at
  // all, so it is written in here rather than left to the render.
  await Promise.all(
    built.map((deck) =>
      run(`pnpm run --silent build:meta ${deck.slug} ${deck.mdx}`)
    )
  )

  await Promise.all(
    built.map((deck) =>
      run(
        `pnpm run --silent build:oembed ${deck.slug} ${deck.mdx} > ./dist/${deck.slug}/oembed.json`
      )
    )
  )

  const cards = await Promise.all(
    built.map((deck) =>
      run(`pnpm run --silent build:index ${deck.slug} ${deck.mdx}`)
    )
  )

  // Talks hosted elsewhere are rendered straight from their definition —
  // there is nothing to build, screenshot or serve for them. They go after
  // the decks in this repository, in the order the file lists them.
  const external = loadExternalTalks().map((talk) =>
    renderCard({
      title: talk.title,
      href: talk.url,
      thumbnail: talk.thumbnail || null,
      external: true,
    })
  )
  if (external.length) {
    console.log(`[index] ${external.length} external talk(s) listed`)
  }

  const template = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'index.html'),
    'utf8'
  )
  fs.writeFileSync(
    path.join(__dirname, '..', 'dist', 'index.html'),
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
