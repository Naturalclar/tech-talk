#!/usr/bin/env ts-node

const [title] = process.argv.slice(2)

const slides = (slug: string) => {
  const thumbnailUrl = `./${slug}.png`
  const htmlUrl = `./${slug}/`

  return {
    thumbnailUrl,
    htmlUrl,
  }
}
const param = slides(title)

const slidesHTML = ({
  thumbnailUrl,
  htmlUrl,
}: {
  thumbnailUrl: string
  htmlUrl: string
}) => {
  return `
          <div class="col-4">
            <a href="${htmlUrl}" >
              <div class="card h-100" style="width: 18rem;">            
                <img "card-img-top" src="${thumbnailUrl}" >
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
