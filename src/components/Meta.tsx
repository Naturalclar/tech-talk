import React from 'react'

// taken from https://github.com/Leko/slides

// slug has no default on purpose. It has to match the deck's folder name,
// because that is what the build names the screenshot and the oembed file
// after. Falling back to the title used to hide that: the decks that omitted
// slug happened to have the folder name as their title, so everything worked
// until someone wrote a real title, at which point og:image and the oEmbed
// link would quietly start pointing at files that do not exist.
const Meta = ({
  title,
  description = title,
  locale = 'ja_JP',
  publishedAt,
  slug,
}) => {
  if (!slug) {
    throw new Error(`<Meta> is missing the slug prop (title: ${title})`)
  }

  return (
    <>
      <meta name="twitter:description" content={description} />
      <meta property="og:description" content={description} />
      <meta property="og:locale" content={locale} />
      <meta property="og:title" content={title} />
      <meta property="og:type" content="article" />
      <meta
        property="og:url"
        content={`https://slides.naturalclar.dev/${slug}/`}
      />
      <meta
        property="og:image"
        content={`https://slides.naturalclar.dev/${slug}.png`}
      />
      <meta
        property="article:published_time"
        content={publishedAt.toISOString()}
      />
      <meta property="article:author" content="naturalclar" />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta
        name="twitter:image"
        content={`https://slides.naturalclar.dev/${slug}.png`}
      />
      <title>{title}</title>
      <link
        rel="alternate"
        type="application/json+oembed"
        href={`https://slides.naturalclar.dev/${slug}/oembed.json`}
        title={title}
      />
    </>
  )
}

export default Meta
