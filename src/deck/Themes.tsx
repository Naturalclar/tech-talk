// Shared across every deck. remdx paints a black backdrop and takes its text
// colour from the theme, so a deck that exports none renders black on black.
// `default` is what a slide gets when it names no theme, which is all of them:
// these talks were written for mdx-deck's "swiss" theme, so light background
// with dark text is what they were presented with.
export const Themes = {
  dark: {
    backgroundColor: 'var(--text-color)',
    color: 'var(--background-color)',
  },

  default: {
    backgroundColor: 'var(--background-color)',
    color: 'var(--text-color)',
  },
}
