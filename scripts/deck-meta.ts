import fs from 'fs'
import path from 'path'
import { parsePublishedAt } from './published-at.ts'

export interface DeckMeta {
  title: string
  description: string
  slug: string
  publishedAt: string | null
}

// A deck's metadata lives beside its slides in meta.json. It used to be
// scraped out of the MDX with a regular expression, back when the deck
// rendered it through a <Meta> component; nothing renders it now, the build
// writes the tags itself, so it is plain data.
export const parseMeta = (deckDir: string, fallbackSlug: string): DeckMeta => {
  const file = path.join(deckDir, 'meta.json')

  let parsed: any
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    throw new Error(`${file}: ${(err as Error).message}`)
  }

  if (!parsed || typeof parsed.title !== 'string' || !parsed.title) {
    throw new Error(`${file}: needs a title`)
  }

  return {
    title: parsed.title,
    description: parsed.description || parsed.title,
    slug: typeof parsed.slug === 'string' ? parsed.slug : fallbackSlug,
    publishedAt: parsePublishedAt(parsed.publishedAt, file),
  }
}
