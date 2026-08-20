import { escapeText } from './escape.ts'
import { SITE_URL } from './site.ts'

export interface SitemapEntry {
  // Path under SITE_URL, with its trailing slash: '/' or '/<slug>/'.
  path: string
  // YYYY-MM-DD, or null for a page with no date of its own.
  lastmod: string | null
}

// Talks hosted elsewhere are deliberately absent. A sitemap says "these are
// my pages"; a card linking somewhere else is not one of them, and listing
// another site's URLs here is at best ignored.
export const renderSitemap = (entries: SitemapEntry[]): string => {
  const urls = entries.map(({ path, lastmod }) => {
    const location = `    <loc>${escapeText(SITE_URL + path)}</loc>`
    return lastmod
      ? `  <url>\n${location}\n    <lastmod>${escapeText(lastmod)}</lastmod>\n  </url>`
      : `  <url>\n${location}\n  </url>`
  })

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`
}

// Nothing here is private, and there is no crawl budget worth shaping, so the
// only job this file has is pointing at the sitemap. It has to exist for that
// line to be read at all: a 404 is not a place to put a Sitemap directive.
export const renderRobots = (): string => `User-agent: *
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`
