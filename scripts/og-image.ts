// A talk hosted elsewhere has no screenshot in dist/ to point a card at, and
// asking the author to paste an image URL into external-talks.json duplicates
// something the page already declares. This reads that declaration instead:
// the og:image the linked page serves to every other link unfurler.
//
// It is best effort by design. The pages are on someone else's host, and a
// deploy must not fail because one of them is slow, moved, or gone — a card
// without a thumbnail is a worse card, not a broken build.

const TIMEOUT_MS = 10000

// og:image lives in <head>, so the rest of the document is never worth
// reading. Slide decks in particular ship large JavaScript bundles inline.
const MAX_BYTES = 512 * 1024

const META = /<meta\b[^>]*>/gi
const ATTR = (name: string) =>
  new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i')

const attr = (tag: string, name: string): string | null => {
  const found = tag.match(ATTR(name))
  if (!found) return null
  const value = found[2] ?? found[3] ?? found[4]
  return value === undefined ? null : value
}

// Entities are rare in a URL but "&amp;" is not: a query string with more than
// one parameter picks it up whenever the page is written by hand.
const decodeEntities = (value: string): string =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&(?:quot|#34);/g, '"')
    .replace(/&(?:apos|#39);/g, "'")
    .replace(/&(?:lt|#60);/g, '<')
    .replace(/&(?:gt|#62);/g, '>')
    .replace(/&(?:amp|#38);/g, '&')

// og:image is the one every unfurler reads; twitter:image is the fallback a
// page sets when it wants a different crop for Twitter, and some pages set
// only that one. Both may be relative to the page.
const IMAGE_KEYS = ['og:image', 'og:image:url', 'twitter:image']

export const findImage = (html: string, pageUrl: string): string | null => {
  const found: { [key: string]: string } = {}

  for (const tag of html.match(META) || []) {
    // The attribute is `property` per Open Graph and `name` per the HTML
    // spec, and pages use both spellings for both vocabularies.
    const key = (attr(tag, 'property') || attr(tag, 'name') || '').toLowerCase()
    if (!IMAGE_KEYS.includes(key) || found[key]) continue

    // An empty content would otherwise resolve to the page itself and put the
    // deck's own HTML in an <img src>.
    const content = (attr(tag, 'content') || '').trim()
    if (!content) continue

    try {
      // Resolves a relative content against the page it came from, and
      // rejects anything that is not a URL at all.
      const resolved = new URL(decodeEntities(content), pageUrl)
      // The value goes straight into an <img src> on the landing page, so
      // only the two schemes a browser will actually fetch an image over are
      // worth keeping — never javascript:, and never a page-local fragment.
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') {
        found[key] = resolved.href
      }
    } catch {
      // Not a URL. Keep looking; a later tag may carry a usable one.
    }
  }

  for (const key of IMAGE_KEYS) {
    if (found[key]) return found[key]
  }
  return null
}

export const fetchOgImage = async (pageUrl: string): Promise<string | null> => {
  let response: Response
  try {
    response = await fetch(pageUrl, {
      headers: { accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (err) {
    console.log(`[og] ${pageUrl}: unreachable (${(err as Error).message})`)
    return null
  }

  if (!response.ok) {
    console.log(`[og] ${pageUrl}: HTTP ${response.status}`)
    return null
  }

  let html: string
  try {
    html = await readHead(response)
  } catch (err) {
    console.log(`[og] ${pageUrl}: unreadable (${(err as Error).message})`)
    return null
  }

  // Redirects are followed, so the image may be relative to somewhere other
  // than the URL asked for.
  const landed = response.url || pageUrl
  const image = findImage(html, landed)
  if (!image) {
    console.log(`[og] ${pageUrl}: no image`)
    return null
  }

  // A tag that exists is not the same as an image that loads. Every deck
  // listed here bakes an absolute og:image into its HTML, so a deck that
  // moved host still advertises the address it had when it was built — the
  // three talks this was written for all point at now.sh from pages now
  // served off vercel.app. Left alone that is a broken <img> on the landing
  // page, which is worse than the placeholder it replaces.
  if (await loads(image)) {
    console.log(`[og] ${pageUrl}: ${image}`)
    return image
  }

  // The image is almost always an asset of the deck itself, so where the deck
  // is now is where the image is now.
  for (const moved of movedWith(image, landed)) {
    if (await loads(moved)) {
      console.log(`[og] ${pageUrl}: ${moved} (og:image ${image} is gone)`)
      return moved
    }
  }

  console.log(`[og] ${pageUrl}: ${image} does not load`)
  return null
}

// The og:image's filename, re-pointed at where the page actually lives, and
// then at the root of the host serving it.
//
// The directory comes first because it is the one that survives a move: a
// deck served from example.com/my-talk/ keeps its card.png beside itself, so
// example.com/my-talk/card.png is the address, not example.com/card.png. The
// root is still worth trying second — a deck that had a subdomain to itself
// puts its assets at the top, which is exactly the shape of the three 2019
// talks this fallback was first written for.
const movedWith = (imageUrl: string, pageUrl: string): string[] => {
  try {
    const image = new URL(imageUrl)
    const page = new URL(pageUrl)

    const candidates = [
      // ./card.png relative to the page, keeping any query with it.
      new URL(
        `.${image.pathname.slice(image.pathname.lastIndexOf('/'))}${image.search}`,
        page
      ).href,
      new URL(image.pathname + image.search, page.origin).href,
    ]

    // Anything that is already the address just tried, or a duplicate of the
    // other candidate, is not worth a second request.
    return candidates.filter(
      (candidate, i) =>
        candidate !== image.href && candidates.indexOf(candidate) === i
    )
  } catch {
    return []
  }
}

// HEAD is enough to know an image is there, and avoids downloading it. Hosts
// that refuse the method get a GET that is cancelled as soon as the status
// line arrives, rather than being written off as missing.
const loads = async (imageUrl: string): Promise<boolean> => {
  const ask = async (method: 'HEAD' | 'GET'): Promise<Response | null> => {
    try {
      return await fetch(imageUrl, {
        method,
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      return null
    }
  }

  const head = await ask('HEAD')
  if (head?.ok) {
    await head.body?.cancel().catch(() => {})
    return true
  }

  if (head && head.status !== 405 && head.status !== 501) {
    await head.body?.cancel().catch(() => {})
    return false
  }

  const get = await ask('GET')
  const ok = !!get?.ok
  await get?.body?.cancel().catch(() => {})
  return ok
}

// Stops at </head> or MAX_BYTES rather than buffering a whole deck.
const readHead = async (response: Response): Promise<string> => {
  const body = response.body
  if (!body) return ''

  const decoder = new TextDecoder()
  const reader = body.getReader()
  let html = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      html += decoder.decode(value, { stream: true })
      if (/<\/head>/i.test(html) || html.length >= MAX_BYTES) break
    }
  } finally {
    await reader.cancel().catch(() => {})
  }

  return html
}
