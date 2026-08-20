// There is no test runner in this repository, so this is a script: run it
// with `node ./scripts/og-image.test.ts`. It serves the fixtures below from a
// local port, which is the only way to exercise fetchOgImage without reaching
// a real host — and the failure paths (404, timeout, connection refused, an
// og:image that no longer loads) are the point, since every one of them has
// to end in a card rather than a broken build or a broken image.
//
// {ORIGIN} in a fixture is replaced with the test server's own origin, so a
// fixture can declare an absolute og:image that actually resolves.

import http from 'http'
import { fetchOgImage, findImage } from './og-image.ts'

const FIXTURES: { [path: string]: string } = {
  '/absolute': `<html><head>
    <meta property="og:image" content="{ORIGIN}/img/card.png"/>
  </head><body>deck</body></html>`,

  '/relative': `<html><head>
    <meta property="og:image" content="/img/card.png"/>
  </head></html>`,

  '/nested/dot-relative': `<html><head>
    <meta property="og:image" content="card.png"/>
  </head></html>`,

  // The HTML spec's attribute rather than Open Graph's.
  '/name-attr': `<html><head>
    <meta name="og:image" content="{ORIGIN}/img/card.png"/>
  </head></html>`,

  '/single-quotes': `<html><head>
    <meta property='og:image' content='{ORIGIN}/img/card.png'/>
  </head></html>`,

  // og:image wins even when twitter:image is declared first.
  '/both': `<html><head>
    <meta name="twitter:image" content="{ORIGIN}/img/twitter.png"/>
    <meta property="og:image" content="{ORIGIN}/img/card.png"/>
  </head></html>`,

  '/twitter-only': `<html><head>
    <meta name="twitter:image" content="{ORIGIN}/img/twitter.png"/>
  </head></html>`,

  '/none': `<html><head><title>a deck with no image</title></head></html>`,

  '/javascript-url': `<html><head>
    <meta property="og:image" content="javascript:alert(1)"/>
  </head></html>`,

  '/empty-content': `<html><head>
    <meta property="og:image" content="  "/>
  </head></html>`,

  // A client-rendered deck: the tag is real but the body is enormous. The
  // reader has to stop at </head> rather than buffering the bundle.
  '/huge': `<html><head>
    <meta property="og:image" content="{ORIGIN}/img/card.png"/>
  </head><body>${'x'.repeat(4 * 1024 * 1024)}</body></html>`,

  // A deck that moved host: the absolute og:image still names where it used
  // to live, and that address is dead. The same path is served from here.
  '/moved': `<html><head>
    <meta property="og:image" content="http://127.0.0.1:1/img/card.png"/>
  </head></html>`,

  // Moved, and the path is not served on this origin either.
  '/moved-and-gone': `<html><head>
    <meta property="og:image" content="http://127.0.0.1:1/img/nowhere.png"/>
  </head></html>`,

  // A deck that moved into a sub-directory. Its og:image still names the
  // root of the host it used to have to itself, and the file now sits beside
  // the page rather than at the top of the new host.
  '/talk/moved-to-subdir': `<html><head>
    <meta property="og:image" content="http://127.0.0.1:1/card.png"/>
  </head></html>`,

  // The same shape, but the file really is at the root of the new host —
  // which is what the three 2019 talks look like.
  '/moved-to-root': `<html><head>
    <meta property="og:image" content="http://127.0.0.1:1/img/card.png"/>
  </head></html>`,

  // Same origin, image simply deleted — there is nowhere else to look.
  '/image-404': `<html><head>
    <meta property="og:image" content="/img/deleted.png"/>
  </head></html>`,

  // A host that rejects HEAD. The image is there; a GET has to confirm it.
  '/head-405': `<html><head>
    <meta property="og:image" content="/img/no-head.png"/>
  </head></html>`,
}

let failures = 0

const check = (name: string, actual: unknown, expected: unknown): void => {
  const ok = actual === expected
  if (!ok) failures++
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name}${ok ? '' : `\n       expected: ${expected}\n       actual:   ${actual}`}`
  )
}

const main = async () => {
  let origin = ''

  const server = http.createServer((req, res) => {
    const url = req.url || '/'
    const method = req.method || 'GET'

    // Sits beside /nested/dot-relative and /talk/moved-to-subdir, so a
    // relative og:image — or the directory fallback — lands on it.
    if (url === '/nested/card.png' || url === '/talk/card.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' })
      res.end(method === 'HEAD' ? undefined : Buffer.from([0x89, 0x50]))
      return
    }

    // The images. /img/no-head.png exists but refuses HEAD; /img/deleted.png
    // and everything else under /img/ is gone.
    if (url.startsWith('/img/')) {
      if (url === '/img/no-head.png' && method === 'HEAD') {
        res.writeHead(405)
        res.end()
        return
      }
      if (url === '/img/card.png' || url === '/img/no-head.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        res.end(method === 'HEAD' ? undefined : Buffer.from([0x89, 0x50]))
        return
      }
      if (url === '/img/twitter.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        res.end(method === 'HEAD' ? undefined : Buffer.from([0x89, 0x50]))
        return
      }
      res.writeHead(404)
      res.end()
      return
    }

    if (url === '/404') {
      res.writeHead(404)
      res.end('not found')
      return
    }

    if (url === '/slow') {
      // Longer than fetchOgImage's timeout, and never answered.
      setTimeout(() => res.end(''), 60000).unref()
      return
    }

    if (url === '/redirect') {
      res.writeHead(302, { Location: '/relative' })
      res.end()
      return
    }

    const body = FIXTURES[url]
    if (body === undefined) {
      res.writeHead(404)
      res.end('no fixture')
      return
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(body.replaceAll('{ORIGIN}', origin))
  })

  const port: number = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address ? address.port : 0)
    })
  })

  origin = `http://127.0.0.1:${port}`
  const at = (p: string) => fetchOgImage(`${origin}${p}`)
  const img = `${origin}/img/card.png`

  console.log('--- parsing ---')
  check('absolute og:image', await at('/absolute'), img)
  check('root-relative resolves against the page', await at('/relative'), img)
  check(
    'path-relative resolves against the page',
    await at('/nested/dot-relative'),
    `${origin}/nested/card.png`
  )
  check('name= is read as well as property=', await at('/name-attr'), img)
  check('single-quoted attributes', await at('/single-quotes'), img)
  check('og:image beats twitter:image', await at('/both'), img)
  check(
    'twitter:image is used when it is the only one',
    await at('/twitter-only'),
    `${origin}/img/twitter.png`
  )
  check(
    'a redirect resolves relative to where it landed',
    await at('/redirect'),
    img
  )
  check(
    'stops at </head> instead of reading a 4MB body',
    await at('/huge'),
    img
  )

  console.log('\n--- the image itself has to load ---')
  check(
    'a deck that moved host falls back to the same path on the new one',
    await at('/moved'),
    img
  )
  check(
    '...but only when that path is really there',
    await at('/moved-and-gone'),
    null
  )
  check(
    'a deck in a sub-directory looks beside itself, not at the root',
    await at('/talk/moved-to-subdir'),
    `${origin}/talk/card.png`
  )
  check(
    '...and still falls back to the root when that is where the file is',
    await at('/moved-to-root'),
    img
  )
  check('a deleted image on the same origin', await at('/image-404'), null)
  check(
    'a host that refuses HEAD is confirmed with GET',
    await at('/head-405'),
    `${origin}/img/no-head.png`
  )

  console.log('\n--- every failure ends in null, never a throw ---')
  check('no meta tags', await at('/none'), null)
  check('a javascript: url is never emitted', await at('/javascript-url'), null)
  check('whitespace-only content', await at('/empty-content'), null)
  check('HTTP 404', await at('/404'), null)
  check('connection refused', await fetchOgImage('http://127.0.0.1:1/'), null)
  check('not a URL at all', await fetchOgImage('not-a-url'), null)

  const startedAt = Date.now()
  check('a server that never answers', await at('/slow'), null)
  const elapsed = Date.now() - startedAt
  check(
    `timed out in ${elapsed}ms, under 15s`,
    elapsed > 5000 && elapsed < 15000,
    true
  )

  console.log('\n--- findImage is pure, and tolerates junk ---')
  check('empty document', findImage('', 'https://example.com/'), null)
  check(
    'unterminated tag',
    findImage('<meta property="og:image" content=', 'https://example.com/'),
    null
  )
  check(
    'og:image:url is read too',
    findImage(
      '<meta property="og:image:url" content="/a.png">',
      'https://example.com/deck/'
    ),
    'https://example.com/a.png'
  )
  check(
    '&amp; in a query string is decoded',
    findImage(
      '<meta property="og:image" content="https://cdn.example.com/c.png?a=1&amp;b=2">',
      'https://example.com/'
    ),
    'https://cdn.example.com/c.png?a=1&b=2'
  )

  server.close()

  console.log(failures ? `\n${failures} failure(s)` : '\nall passed')
  process.exitCode = failures ? 1 : 0
}

main()
