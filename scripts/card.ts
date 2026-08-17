// The listing's card, shared by the two things that produce one: the
// build:index CLI for decks in this repository, and generate-slides.ts for
// talks hosted elsewhere. Keeping a single template means an external card
// cannot drift into looking like a different component.
//
// Tailwind finds the classes below by scanning this file — src/index.css
// names it with @source. A class assembled by concatenation would not be
// found, and the card would render unstyled without any error.

import { formatPublishedAt } from './published-at.ts'

export interface Card {
  title: string
  href: string
  // Absent for an external talk whose thumbnail could not be supplied.
  thumbnail: string | null
  // YYYY-MM-DD. Absent only if a talk has no date recorded at all.
  publishedAt: string | null
  external?: boolean
}

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const renderCard = ({
  title,
  href,
  thumbnail,
  publishedAt,
  external,
}: Card): string => {
  // The 16:9 box belongs to the div, and the image is stretched inside it.
  // Putting the ratio on the <img> instead leaves the height depending on
  // how a browser reconciles aspect-ratio with the file's own dimensions,
  // and on the image having loaded at all — here the box is the same size
  // before the request finishes, after it fails, and for the placeholder.
  //
  // It has to be a fixed box because the sources do not agree: a deck's
  // screenshot is 1280x720, an og:image fetched from someone else's page is
  // whatever they made it (1200x630 is typical), and each one used to set
  // its own card's height.
  //
  // object-contain rather than object-cover: these are cards with text on
  // them, made to be read whole, and the aspect ratio of a page nobody here
  // controls is not something to bet on. Letterboxing against the same grey
  // as the placeholder loses nothing.
  const image = thumbnail
    ? `<div class="relative aspect-video w-full bg-gray-100">
              <img src="${escapeAttr(thumbnail)}" alt="${escapeAttr(title)}" class="absolute inset-0 h-full w-full object-contain" />
            </div>`
    : `<div class="flex aspect-video w-full items-center justify-center bg-gray-100 text-sm text-gray-400">no thumbnail</div>`

  // Date and badge share a row: they are both "about" the talk rather than
  // part of its title, and stacking them would make external cards taller
  // than the decks beside them.
  const date = publishedAt
    ? `<time datetime="${escapeAttr(publishedAt)}">${escapeText(formatPublishedAt(publishedAt))}</time>`
    : ''

  const badge = external ? `<span>外部サイト ↗</span>` : ''

  const footer =
    date || badge
      ? `
              <p class="mt-2 flex items-center gap-2 text-sm text-gray-500">${date}${badge}</p>`
      : ''

  const target = external
    ? `
            target="_blank"
            rel="noopener noreferrer"`
    : ''

  return `
          <a
            href="${escapeAttr(href)}"${target}
            class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 transition hover:border-gray-300 hover:shadow-md"
          >
            ${image}
            <div class="p-4">
              <h2 class="min-h-14 text-lg font-medium text-gray-900">
                ${escapeText(title)}
              </h2>${footer}
            </div>
          </a>
          `
}
