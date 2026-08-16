// There is no test runner in this repository, so this is a script: run it
// with `node ./scripts/og-image.test.ts`. It serves the fixtures below from a
// local port, which is the only way to exercise fetchOgImage without reaching
// a real host — and the failure paths (404, timeout, connection refused) are
// the point, since every one of them has to end in a card rather than a
// broken build.

import http from 'http'
import { fetchOgImage, findImage } from './og-image.ts'

const FIXTURES: { [path: string]: string } = {
  '/absolute': `<html><head>
    <meta property="og:image" content="https://cdn.example.com/card.png"/>
  </head><body>deck</body></html>`,

  '/relative': `<html><head>
    <meta property="og:image" content="/static/card.png"/>
  </head></html>`,

  '/dot-relative': `<html><head>
    <meta property="og:image" content="card.png"/>
  </head></html>`,

  // The HTML spec's attribute rather than Open Graph's.
  '/name-attr': `<html><head>
    <meta name="og:image" content="https://cdn.example.com/by-name.png"/>
  </head></html>`,

  '/single-quotes': `<html><head>
    <meta property='og:image' content='https://cdn.example.com/quoted.png'/>
  </head></html>`,

  '/entities': `<html><head>
    <meta property="og:image" content="https://cdn.example.com/c.png?a=1&amp;b=2"/>
  </head></html>`,

  // og:image wins even when twitter:image is declared first.
  '/both': `<html><head>
    <meta name="twitter:image" content="https://cdn.example.com/twitter.png"/>
    <meta property="og:image" content="https://cdn.example.com/og.png"/>
  </head></html>`,

  '/twitter-only': `<html><head>
    <meta name="twitter:image" content="https://cdn.example.com/twitter.png"/>
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
    <meta property="og:image" content="https://cdn.example.com/huge.png"/>
  </head><body>${'x'.repeat(4 * 1024 * 1024)}</body></html>`,
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
  const server = http.createServer((req, res) => {
    const url = req.url || '/'

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
    res.end(body)
  })

  const port: number = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(typeof address === 'object' && address ? address.port : 0)
    })
  })

  const origin = `http://127.0.0.1:${port}`
  const at = (p: string) => fetchOgImage(`${origin}${p}`)

  console.log('--- parsing ---')
  check(
    'absolute og:image',
    await at('/absolute'),
    'https://cdn.example.com/card.png'
  )
  check(
    'root-relative resolves against the page',
    await at('/relative'),
    `${origin}/static/card.png`
  )
  check(
    'path-relative resolves against the page',
    await at('/dot-relative'),
    `${origin}/card.png`
  )
  check(
    'name= is read as well as property=',
    await at('/name-attr'),
    'https://cdn.example.com/by-name.png'
  )
  check(
    'single-quoted attributes',
    await at('/single-quotes'),
    'https://cdn.example.com/quoted.png'
  )
  check(
    '&amp; in a query string is decoded',
    await at('/entities'),
    'https://cdn.example.com/c.png?a=1&b=2'
  )
  check(
    'og:image beats twitter:image',
    await at('/both'),
    'https://cdn.example.com/og.png'
  )
  check(
    'twitter:image is used when it is the only one',
    await at('/twitter-only'),
    'https://cdn.example.com/twitter.png'
  )
  check(
    'a redirect resolves relative to where it landed',
    await at('/redirect'),
    `${origin}/static/card.png`
  )
  check(
    'stops at </head> instead of reading a 4MB body',
    await at('/huge'),
    'https://cdn.example.com/huge.png'
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

  server.close()

  console.log(failures ? `\n${failures} failure(s)` : '\nall passed')
  process.exitCode = failures ? 1 : 0
}

main()
