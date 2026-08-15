'use strict'
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod }
  }
Object.defineProperty(exports, '__esModule', { value: true })
const path_1 = __importDefault(require('path'))
const vite_plugin_remdx_1 = __importDefault(require('@nkzw/vite-plugin-remdx'))
const plugin_react_1 = __importDefault(require('@vitejs/plugin-react'))
const vite_1 = require('vite')
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
const slides = path_1.default.resolve(
  __dirname,
  'src',
  'talks',
  deck,
  'slides.re.mdx'
)
exports.default = (0, vite_1.defineConfig)({
  base: `/${deck}/`,
  build: {
    emptyOutDir: true,
    outDir: path_1.default.resolve(__dirname, 'dist', deck),
  },
  plugins: [(0, vite_plugin_remdx_1.default)(), (0, plugin_react_1.default)()],
  resolve: {
    alias: {
      'deck:slides': slides,
      // The three decks that demo react-native-web import from 'react-native'.
      'react-native': 'react-native-web',
    },
  },
  root: path_1.default.resolve(__dirname, 'src', 'deck'),
})
