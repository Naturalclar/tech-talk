// Escaping for the HTML these scripts assemble by hand. There is no template
// engine here — cards and meta tags are string literals — so this is the only
// thing standing between a talk title with an ampersand in it and broken
// markup. Three modules needed the same two functions; they live here rather
// than as a third copy.

export const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
