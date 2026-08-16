import fs from 'fs'
import path from 'path'
import { parsePublishedAt } from './published-at.ts'

export interface ExternalTalk {
  title: string
  url: string
  // Optional: a talk hosted elsewhere may have no image to point at, and the
  // card reserves the space rather than collapsing.
  thumbnail?: string
  // The same field name a deck's meta.json uses, for the same reason: it is
  // shown on the card and it decides where the card lands in the listing.
  publishedAt?: string
}

const source = path.join(
  import.meta.dirname,
  '..',
  'src',
  'external-talks.json'
)

// Talks published somewhere other than this repository. They are listed
// alongside the built decks but nothing is generated for them: no deck build,
// no screenshot, and no oembed.json, since this site does not serve them.
export const loadExternalTalks = (): ExternalTalk[] => {
  if (!fs.existsSync(source)) return []

  let parsed: any
  try {
    parsed = JSON.parse(fs.readFileSync(source, 'utf8'))
  } catch (err) {
    throw new Error(
      `src/external-talks.json is not valid JSON: ${(err as Error).message}`
    )
  }

  if (!Array.isArray(parsed)) {
    throw new Error('src/external-talks.json must contain an array')
  }

  // A typo here would otherwise surface as a card linking to "undefined".
  parsed.forEach((talk: any, i: number) => {
    if (!talk || typeof talk.title !== 'string' || !talk.title) {
      throw new Error(`src/external-talks.json[${i}] needs a title`)
    }
    if (typeof talk.url !== 'string' || !/^https?:\/\//.test(talk.url)) {
      throw new Error(
        `src/external-talks.json[${i}] (${talk.title}) needs an absolute http(s) url`
      )
    }
    if (talk.thumbnail !== undefined && typeof talk.thumbnail !== 'string') {
      throw new Error(
        `src/external-talks.json[${i}] (${talk.title}) has a non-string thumbnail`
      )
    }
    parsePublishedAt(
      talk.publishedAt,
      `src/external-talks.json[${i}] (${talk.title})`
    )
  })

  return parsed
}
