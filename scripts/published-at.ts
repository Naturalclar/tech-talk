// The date a talk was given. It comes from two places — a deck's meta.json
// and an entry in external-talks.json — and both feed the same card and the
// same ordering, so both are read through here.
//
// It used to be metadata only: parsed once by generate-meta.ts for the
// article:published_time tag, where a typo produced an invalid Date and the
// build died on RangeError deep inside toISOString. Now it also decides where
// a card lands in the listing, where a bad value would sort wrong in silence
// instead of failing. So it is checked when it is read.

const SHAPE = /^\d{4}-\d{2}-\d{2}$/

export const parsePublishedAt = (
  value: unknown,
  where: string
): string | null => {
  if (value === undefined || value === null || value === '') return null

  if (typeof value !== 'string' || !SHAPE.test(value)) {
    throw new Error(`${where}: publishedAt must be YYYY-MM-DD, got ${value}`)
  }

  // The shape alone accepts 2019-02-31. Date rolls that over to March 3
  // rather than rejecting it, so the round trip is what catches it.
  const date = new Date(`${value}T00:00:00Z`)
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error(`${where}: publishedAt is not a real date: ${value}`)
  }

  return value
}

// Rendered into the card. Deliberately not toLocaleDateString: the build
// machine's locale is not the reader's, and Netlify's is not this one's.
export const formatPublishedAt = (value: string): string =>
  value.replaceAll('-', '.')

// Newest first. Talks with no date go last rather than being dropped, and
// ties keep the order they were collected in, so the listing does not shuffle
// between builds.
export const byNewest = <T extends { publishedAt: string | null }>(
  items: T[]
): T[] =>
  items
    .map((item, index) => ({ index, item }))
    .sort((a, b) => {
      const left = a.item.publishedAt
      const right = b.item.publishedAt
      if (left !== right) {
        if (!left) return 1
        if (!right) return -1
        return left < right ? 1 : -1
      }
      return a.index - b.index
    })
    .map(({ item }) => item)
