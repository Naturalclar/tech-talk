#!/usr/bin/env ts-node

import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'

// playwright's type definitions target a much newer TypeScript than the 3.4
// this repo is pinned to, so it is required untyped rather than imported.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { chromium } = require('playwright')

const WIDTH = 1280
const HEIGHT = 720

const distDir = path.join(__dirname, '..', 'dist')
const fontsDir = path.join(__dirname, '..', 'fonts')

// Nearly every deck title is Japanese, and a machine with no Japanese font
// renders those titles as tofu boxes. Rather than rely on the build image
// having one — Netlify's cannot be given system packages — the repository
// carries IPAGothic and fontconfig is pointed at it here.
//
// The system configuration is included rather than replaced. Listing font
// directories alone would drop the distribution's family aliases with them,
// and sans-serif would start resolving to IPAGothic's Latin glyphs instead of
// whatever it picks today. Adding one directory on top leaves that untouched:
// the bundled font is only reached for glyphs nothing else provides.
const useBundledFonts = (): void => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fontconfig-'))
  const configPath = path.join(cacheDir, 'fonts.conf')

  fs.writeFileSync(
    configPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
</fontconfig>
`,
    'utf8'
  )

  process.env.FONTCONFIG_FILE = configPath
}

const MIME: { [ext: string]: string } = {
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

// Serves dist/ as the site root rather than a single deck folder, so that a
// deck at /<slug>/ resolves ../assets/foo.png the same way it does in
// production. Decks reference shared images both through webpack's
// file-loader and as plain relative paths, and the latter only work when the
// sibling assets/ directory is reachable.
const startServer = (): Promise<{ port: number; close: () => void }> =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
      let filePath = path.join(distDir, urlPath)
      if (urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html')

      if (filePath.indexOf(distDir) !== 0) {
        res.writeHead(403)
        res.end('forbidden')
        return
      }

      fs.readFile(filePath, (err, body) => {
        if (err) {
          res.writeHead(404)
          res.end('not found')
          return
        }
        const type = MIME[path.extname(filePath).toLowerCase()]
        res.writeHead(200, {
          'Content-Type': type || 'application/octet-stream',
        })
        res.end(body)
      })
    })

    server.listen(0, '127.0.0.1', () => {
      const address: any = server.address()
      resolve({ port: address.port, close: () => server.close() })
    })
  })

const shoot = async (page: any, port: number, slug: string): Promise<void> => {
  await page.goto(`http://127.0.0.1:${port}/${slug}/`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  })

  // The decks render client side, so an empty #root means the slide has not
  // been painted yet and the screenshot would come out blank.
  await page.waitForFunction(
    () => {
      const root = document.getElementById('root')
      return !!root && root.childElementCount > 0
    },
    { timeout: 30000 }
  )

  await page.screenshot({
    path: path.join(distDir, `${slug}.png`),
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  })
}

const main = async () => {
  const slugs = process.argv.slice(2)
  if (!slugs.length) {
    console.log('usage: ./generate-screenshot [slug...]')
    process.exitCode = 1
    return
  }

  useBundledFonts()

  const server = await startServer()
  // Chromium's sandbox is unavailable when the build runs as root or inside a
  // container, which is the normal case for CI images.
  const browser = await chromium.launch({ args: ['--no-sandbox'] })

  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
    })

    for (const slug of slugs) {
      try {
        await shoot(page, server.port, slug)
        console.log(`[screenshot] ${slug}.png`)
      } catch (err) {
        console.error(`[screenshot] failed: ${slug}`, (err as Error).message)
        process.exitCode = 1
      }
    }
  } finally {
    await browser.close()
    server.close()
  }
}

main()
