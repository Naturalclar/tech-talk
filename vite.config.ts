import path from 'path'
import remdx from '@nkzw/vite-plugin-remdx'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
  plugins: [remdx(), react()],
  resolve: {
    alias: {
      'deck:slides': slides,
      // The three decks that demo react-native-web import from 'react-native'.
      'react-native': 'react-native-web',
    },
  },
  root: path.resolve(import.meta.dirname, 'src', 'deck'),
})
