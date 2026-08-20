// Where the built site is published. The metadata is written into the built
// HTML by generate-meta.ts and generate-slides.ts, so this is the only place
// the origin appears.
export const SITE_URL = 'https://slides.naturalclar.dev'

// The landing page's own metadata. Every deck carries its own via meta.json;
// the page that lists them had none at all, so sharing the site itself
// produced an untitled link.
export const SITE_TITLE = '登壇スライド置き場 - naturalclar'

export const SITE_DESCRIPTION =
  'naturalclar の登壇スライド一覧。React Native、Storybook、CI、Claude Code などについて話しました。'

// A screenshot of the listing itself, taken after it is written. A fixed
// image would go stale as talks are added; this one cannot.
export const SITE_IMAGE = `${SITE_URL}/index.png`
