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
  // The column is sized per breakpoint rather than fixed at col-4, which put
  // three cards side by side even on a phone. The card itself carries no
  // width: it used to be pinned to 18rem, which ignored the column it sits in.
  //
  // class= on the image is not cosmetic. Without it Bootstrap's
  // .card-img-top { width: 100% } never applies and the 1280px screenshot is
  // drawn at full size, which overflowed the page by 913px at 375px wide and
  // left the landing page showing one corner of one thumbnail.
  return `
          <div class="col-12 col-sm-6 col-lg-4 mb-4">
            <a href="${htmlUrl}" >
              <div class="card h-100">
                <img class="card-img-top" src="${thumbnailUrl}" alt="${title}">
                <div class="card-body">
                  <h5 class="card-title">
                    ${title}
                  </h5>
                </div>
              </div>
            </a>
          </div>
          `
}

const html = slidesHTML(param)

console.log(html)
