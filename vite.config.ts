import fs from 'fs'
import path from 'path'
import remdx from '@nkzw/vite-plugin-remdx'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { contentType } from './scripts/mime.ts'

// One shared shell (src/deck) builds every deck: the DECK variable points the
// `deck:slides` import at that deck's slides, and the output goes to its own
// folder under dist/. Giving each deck its own index.html and entry point
// instead would be one copy of the same two files per deck.
const deck = process.env.DECK

if (!deck) {
  throw new Error(
    'vite.config.ts: DECK is not set (e.g. DECK=<slug> vite build)'
  )
}

const slides = path.resolve(
  import.meta.dirname,
  'src',
  'talks',
  deck,
  'slides.re.mdx'
)

const assetsDir = path.resolve(import.meta.dirname, 'src', 'talks', 'assets')

// Decks write their shared images as `../assets/foo.png`, which resolves
// against the page's own URL. In the built site that is `/<slug>/`, so the
// path lands on `dist/assets/` — the copy `build:assets` makes. The dev
// server puts the deck at `/` instead, so the same reference normalises to
// `/assets/foo.png` and points a directory above the deck, where there is
// nothing.
//
// Nothing complained about it, which is why it went unnoticed for so long:
// the request fell through to the SPA fallback and came back as `200
// text/html`, so there was no 404 in the console and no error on the page —
// only an image that never drew. Every deck's images were invisible for the
// whole time a deck was being written, which is the one time they matter.
//
// A middleware rather than `publicDir`: the assets have to answer on
// `/assets/`, and `publicDir` serves a directory's *contents* at the root, so
// it would have to be `src/talks` — which would put every deck's slides and
// meta.json on the dev server too, and copy all 14MB of them into every
// deck's build output. This only answers for files that are really there and
// hands everything else back to vite.
const serveSharedAssets = (): Plugin => ({
  configureServer: (server) => {
    server.middlewares.use((request, response, next) => {
      const url = request.url?.split('?')[0]
      if (!url?.startsWith('/assets/')) {
        return next()
      }

      let file: string
      try {
        file = path.join(assetsDir, decodeURIComponent(url.slice(8)))
      } catch {
        // A stray `%` is not a valid escape, and decodeURIComponent throws on
        // it. Left to propagate that is a 500 out of the dev server for a
        // typo in a filename.
        return next()
      }

      // Not an answer this middleware is entitled to give. Anything that
      // climbed out of the assets directory goes back to vite, which is what
      // asked for it in the first place.
      if (!file.startsWith(assetsDir)) {
        return next()
      }

      // A miss is a 404, not something to hand back to vite. Passing it on
      // lands it in the SPA fallback, which answers `200 text/html` — so a
      // deck that names an asset it does not have drew nothing, with no 404
      // in the network panel and no error in the console. That is the same
      // silence this middleware was written to fix for assets that do exist,
      // and it is worst while a deck is being written, which is the one time
      // the images matter.
      //
      // Nothing but the shared assets is served under `/assets/`, so there is
      // no other handler further down that could have answered this.
      if (!fs.existsSync(file)) {
        response.statusCode = 404
        response.setHeader('Content-Type', 'text/plain; charset=utf-8')
        return response.end(`no such shared asset: ${url}\n`)
      }

      response.setHeader('Content-Type', contentType(file))
      fs.createReadStream(file).pipe(response)
    })
  },
  name: 'serve-shared-assets',
})

export default defineConfig({
  // Relative rather than `/${deck}/`: the deck's own folder is the only thing
  // its assets are ever beside, and an absolute base pins the site to the
  // root of a domain. That is what makes it servable from a subpath —
  // <user>.github.io/tech-talk/ — which is where GitHub Pages puts it until
  // the custom domain is pointed at it.
  base: './',
  build: {
    emptyOutDir: true,
    outDir: path.resolve(import.meta.dirname, 'dist', deck),
  },
  plugins: [remdx(), react(), serveSharedAssets()],
  resolve: {
    alias: {
      'deck:slides': slides,
      // The three decks that demo react-native-web import from 'react-native'.
      'react-native': 'react-native-web',
    },
  },
  root: path.resolve(import.meta.dirname, 'src', 'deck'),
})
