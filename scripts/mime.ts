// Content types for the files this repository serves by hand: the screenshot
// script's static server, and the dev server's shared-asset middleware. Both
// need the same answers, and an image served as the wrong type is the kind of
// thing that only shows up as a picture that will not draw — an SVG sent as
// application/octet-stream renders as nothing inside an <img>.
export const MIME: { [ext: string]: string } = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export const contentType = (file: string): string => {
  const dot = file.lastIndexOf('.')
  return (
    (dot === -1 ? undefined : MIME[file.slice(dot).toLowerCase()]) ||
    'application/octet-stream'
  )
}
