#!/usr/bin/env ts-node

import { parseMeta } from './deck-meta'

const [slug, mdxPath] = process.argv.slice(2)

// The card used to be labelled with the slug, because that was the only
// argument this script got. It reads the deck's own <Meta title> now, so the
// listing shows the talk's real title rather than its folder name.
const title = mdxPath ? parseMeta(mdxPath, slug).title : slug

const slides = () => {
  const thumbnailUrl = `./${slug}.png`
  const htmlUrl = `./${slug}/`

  return {
    thumbnailUrl,
    htmlUrl,
  }
}
const param = slides()

const slidesHTML = ({
  thumbnailUrl,
  htmlUrl,
}: {
  thumbnailUrl: string
  htmlUrl: string
}) => {
  // The link is the grid item: src/index.html lays the cards out with CSS
  // grid, so there is no per-card column class and nothing here sets a width.
  //
  // Any class added below has to be visible to Tailwind's scanner. It reads
  // this file because src/index.css names it with @source; a class built by
  // string concatenation would not be found, and would silently render
  // unstyled.
  return `
          <a
            href="${htmlUrl}"
            class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 transition hover:border-gray-300 hover:shadow-md"
          >
            <img src="${thumbnailUrl}" alt="${title}" class="w-full" />
            <div class="p-4">
              <h2 class="text-lg font-medium text-gray-900">
                ${title}
              </h2>
            </div>
          </a>
          `
}

const html = slidesHTML(param)

console.log(html)
