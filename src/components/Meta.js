import React from 'react'

// taken from https://github.com/Leko/slides

const Meta = ({
  title,
  description,
  locale = 'ja_JP',
  publishedAt,
  slug = title,
}) => (
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
    <meta property="article:author" content="Leko" />
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

export default Meta
