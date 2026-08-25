import fs from 'fs'
import path from 'path'
import remdx from '@nkzw/vite-plugin-remdx'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { contentType } from './scripts/mime.ts'

// One shared shell (src/deck) builds every deck: the DECK variable points the
// `deck:slides` import at that deck's slides, and the output goes to its own
// folder under dist/. Giving each deck its own index.html and entry point
// instead would be eight copies of the same two files.
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

      const file = path.join(assetsDir, decodeURIComponent(url.slice(8)))
      if (!file.startsWith(assetsDir) || !fs.existsSync(file)) {
        return next()
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
