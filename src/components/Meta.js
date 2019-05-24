import React from 'react'

// taken from https://github.com/Leko/slides

export const Meta = ({
  title,
  locale = 'ja_JP',
  publishedAt,
  slug = title,
}) => (
  <>
    <meta property="og:locale" content={locale} />
    <meta property="og:title" content={title} />
    <meta property="og:type" content="article" />
    <meta
      property="og:url"
      content={`https://slides.naturalclar.com/${slug}/`}
    />
    <meta
      property="og:image"
      content={`https://slides.naturalclar.com/${slug}.png`}
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
      content={`https://slides.naturalclar.com/${slug}.png`}
    />
    <title>{title}</title>
  </>
)
