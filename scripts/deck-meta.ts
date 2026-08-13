import fs from 'fs'

export interface DeckMeta {
  title: string
  description: string
  slug: string
  publishedAt: string | null
}

// Reads the props off the <Meta /> element a deck declares inside <Head>.
// The decks are the only place this information exists, and parsing it here
// means the build no longer needs mdx-deck to server render the deck just to
// find out what its title is.
export const parseMeta = (mdxPath: string, fallbackSlug: string): DeckMeta => {
  const source = fs.readFileSync(mdxPath, 'utf8')
  const element = source.match(/<Meta\b([\s\S]*?)\/>/)
  const attrs = element ? element[1] : ''

  const stringProp = (name: string): string | null => {
    const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`))
    return match ? match[1] : null
  }

  const title = stringProp('title') || fallbackSlug
  // Meta.tsx defaults description to title and slug to title; mirror that so
  // the injected tags match what a server rendered deck would have produced.
  const description = stringProp('description') || title
  const slug = stringProp('slug') || title

  // publishedAt is a JSX expression. A literal date is usable; a bare
  // `new Date()` means "whenever this was built", which is not a publication
  // date at all, so it is treated as absent.
  const published = attrs.match(/\bpublishedAt\s*=\s*\{\s*new Date\(\s*['"]([^'"]+)['"]\s*\)/)

  return {
    title,
    description,
    slug,
    publishedAt: published ? published[1] : null,
  }
}
