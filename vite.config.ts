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

const slides = path.resolve(__dirname, 'src', 'talks', deck, 'slides.re.mdx')

export default defineConfig({
  base: `/${deck}/`,
  build: {
    emptyOutDir: true,
    outDir: path.resolve(__dirname, 'dist', deck),
  },
  plugins: [remdx(), react()],
  resolve: {
    alias: {
      'deck:slides': slides,
      // The three decks that demo react-native-web import from 'react-native'.
      'react-native': 'react-native-web',
    },
  },
  root: path.resolve(__dirname, 'src', 'deck'),
})
