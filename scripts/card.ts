// The listing's card, shared by the two things that produce one: the
// build:index CLI for decks in this repository, and generate-slides.ts for
// talks hosted elsewhere. Keeping a single template means an external card
// cannot drift into looking like a different component.
//
// Tailwind finds the classes below by scanning this file — src/index.css
// names it with @source. A class assembled by concatenation would not be
// found, and the card would render unstyled without any error.

export interface Card {
  title: string
  href: string
  // Absent for an external talk whose thumbnail could not be supplied.
  thumbnail: string | null
  external?: boolean
}

const escapeAttr = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const escapeText = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export const renderCard = ({ title, href, thumbnail, external }: Card): string => {
  // A talk on another site may not have a usable thumbnail URL. Reserving the
  // same space keeps the grid rows even instead of letting one card collapse.
  const image = thumbnail
    ? `<img src="${escapeAttr(thumbnail)}" alt="${escapeAttr(title)}" class="w-full" />`
    : `<div class="flex aspect-video w-full items-center justify-center bg-gray-100 text-sm text-gray-400">no thumbnail</div>`

  const badge = external
    ? `
              <p class="mt-2 text-sm text-gray-500">外部サイト ↗</p>`
    : ''

  const target = external ? `
            target="_blank"
            rel="noopener noreferrer"` : ''

  return `
          <a
            href="${escapeAttr(href)}"${target}
            class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 transition hover:border-gray-300 hover:shadow-md"
          >
            ${image}
            <div class="p-4">
              <h2 class="text-lg font-medium text-gray-900">
                ${escapeText(title)}
              </h2>${badge}
            </div>
          </a>
          `
}
