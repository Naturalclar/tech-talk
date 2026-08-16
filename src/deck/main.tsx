import { render } from '@nkzw/remdx'
import '@nkzw/remdx/style.css'
import './deck.css'

// Which deck this resolves to is decided by vite.config.ts from the DECK
// environment variable. Every deck shares this entry point, so a deck folder
// holds nothing but its slides and its assets.
render(document.getElementById('root'), import('deck:slides'))
