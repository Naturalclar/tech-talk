/// <reference types="vite/client" />

// The deck the shell renders is chosen at build time, not written down: the
// DECK variable picks a folder and vite.config.ts aliases this specifier at
// that folder's slides.re.mdx. There is no file here for TypeScript to follow,
// so the alias has to be declared.
//
// The shape is remdx's own, spelled out from the types it exports, because
// `render` takes the whole module rather than a value out of it: the slide
// array is the default export and the theme is a named one. `unknown` here
// type-checks the import and then fails at the call, which is worse than not
// declaring it at all.
//
// Themes is declared present rather than optional because it is: a deck that
// exports none renders black text on remdx's black backdrop, so every
// slides.re.mdx re-exports the shared one, and the scaffold starts with it.
declare module 'deck:slides' {
  import type { ReMDXSlide, Themes as ThemeMap } from '@nkzw/remdx'

  const slides: ReadonlyArray<ReMDXSlide>
  export default slides
  export const Themes: ThemeMap
}
