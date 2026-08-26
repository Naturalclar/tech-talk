// The listing's card, shared by the two things that produce one: the
// build:index CLI for decks in this repository, and generate-slides.ts for
// talks hosted elsewhere. Keeping a single template means an external card
// cannot drift into looking like a different component.
//
// Tailwind finds the classes below by scanning this file — src/index.css
// names it with @source. A class assembled by concatenation would not be
// found, and the card would render unstyled without any error.

import { escapeAttr, escapeText } from './escape.ts'
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
  //
  // The thumbnail sits inset from the card with a border of its own. Bled to
  // the card's edge it read as the card's own lid rather than as a picture of
  // something, and a letterboxed image had no edge at all where its grey met
  // the white below it. mb-0 keeps the gap to the title the padding of the
  // block underneath, so it does not double up.
  //
  // `loading="lazy"` because the listing is thirty cards and about two rows of
  // them are on screen: without it a visitor downloaded all thirty
  // screenshots, 1.09MB, before seeing any of the page, and it grows by one
  // every time a talk is added. Nothing jumps when the rest arrive — the box
  // is `aspect-video`, so it is the same size before the request finishes,
  // after it fails, and for the placeholder.
  //
  // Every card gets it, including the first row. A browser fetches a lazy
  // image that is already in the viewport immediately, so there is nothing to
  // win by exempting them — and picking the first n by hand would mean this
  // template no longer renders both kinds of card the same way, which is the
  // whole reason it is one template.
  const image = thumbnail
    ? `<div class="relative m-4 mb-0 aspect-video overflow-hidden rounded-md border border-gray-200 bg-gray-100">
              <img src="${escapeAttr(thumbnail)}" alt="${escapeAttr(title)}" loading="lazy" decoding="async" class="absolute inset-0 h-full w-full object-contain" />
            </div>`
    : `<div class="m-4 mb-0 flex aspect-video items-center justify-center rounded-md border border-gray-200 bg-gray-100 text-sm text-gray-400">no thumbnail</div>`

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

  // The card's own edge is drawn at gray-300 rather than gray-200: a card has
  // to look like a card before the pointer is anywhere near it.
  //
  // Hover thickens that edge with a ring instead of raising border-width. A
  // ring is a box-shadow, so it costs no layout — bumping the border to 2px
  // would take two pixels out of the card's content box and reflow the title
  // under the cursor, which is exactly where a jump is most obvious.
  return `
          <a
            href="${escapeAttr(href)}"${target}
            class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-300 transition hover:border-gray-400 hover:shadow-md hover:ring-1 hover:ring-gray-400"
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
