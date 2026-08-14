#!/usr/bin/env ts-node

import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

// `pnpm start` used to be pinned to one deck, so previewing any other meant
// bypassing the script and remembering the path. It takes a slug now.

const talksDir = path.join(__dirname, '..', 'src', 'talks')

const slugs = (): string[] =>
  fs
    .readdirSync(talksDir)
    .filter((name) => fs.existsSync(path.join(talksDir, name, 'index.mdx')))
    .sort()

const main = () => {
  const slug = process.argv[2]

  if (!slug || !slugs().includes(slug)) {
    console.log(
      slug
        ? `no deck called "${slug}". available decks:`
        : 'usage: pnpm start <slug>\n\navailable decks:'
    )
    slugs().forEach((name) => console.log(`  ${name}`))
    process.exitCode = 1
    return
  }

  const mdx = path.join('src', 'talks', slug, 'index.mdx')
  const child = spawn('pnpm', ['exec', 'mdx-deck', mdx], { stdio: 'inherit' })
  child.on('exit', (code) => {
    process.exitCode = code === null ? 1 : code
  })
}

main()
