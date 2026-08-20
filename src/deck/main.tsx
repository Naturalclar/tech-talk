import { render } from '@nkzw/remdx'
import '@nkzw/remdx/style.css'
import './deck.css'
import { scrollToHighlight } from './scroll-to-highlight.ts'

// Which deck this resolves to is decided by vite.config.ts from the DECK
// environment variable. Every deck shares this entry point, so a deck folder
// holds nothing but its slides and its assets.
const root = document.getElementById('root')!

render(root, import('deck:slides'))

// Has to come after render: it watches the tree remdx draws into.
scrollToHighlight(root)
