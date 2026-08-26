import fs from 'fs'
import http from 'http'
import os from 'os'
import path from 'path'
import { chromium, type Page } from 'playwright'
import { contentType } from './mime.ts'

const WIDTH = 1280
const HEIGHT = 720

const distDir = path.join(import.meta.dirname, '..', 'dist')
const fontsDir = path.join(import.meta.dirname, '..', 'fonts')

// Chinese and Korean fonts cover most of the Japanese a deck uses, so a build
// machine that has one renders the titles in it: Chinese glyph shapes, and
// the kana iteration marks ゝ and ゞ drawn as nothing at all, because those
// fonts map them without an outline. That is not hypothetical — it is how
// 「すゝめ」 came out on the published landing page.
//
// Which font wins is decided by whatever the machine happens to have
// installed, which is exactly what carrying ipag.ttf in the repository was
// meant to stop. Adding a directory only makes the bundled font available;
// it does not make it the one that gets picked.
//
// So the ones that would shadow it are taken out of this process's view.
// Naming families is blunt, and a machine with a CJK font not on this list
// falls back to the old behaviour — no worse than before, just not fixed.
// The alternative, preferring IPAGothic outright, was tried and rejected:
// fontconfig then hands it the Latin text too, and every screenshot's
// English turns monospace.
const SHADOWING_CJK_FONTS = [
  'WenQuanYi Zen Hei',
  'WenQuanYi Zen Hei Mono',
  'WenQuanYi Zen Hei Sharp',
  'WenQuanYi Micro Hei',
  'Noto Sans CJK SC',
  'Noto Sans CJK TC',
  'Noto Sans CJK HK',
  'Noto Sans CJK KR',
  'Noto Serif CJK SC',
  'Noto Serif CJK TC',
  'Noto Serif CJK KR',
  'Source Han Sans',
  'Source Han Serif',
  'Droid Sans Fallback',
  'AR PL UMing CN',
  'AR PL UKai CN',
]

// Nearly every deck title is Japanese, and a machine with no Japanese font at
// all renders those titles as tofu boxes. The deployed site is built on a
// machine nobody here provisions, so the font travels with the repository.
//
// The system configuration is included rather than replaced: listing font
// directories alone would drop the distribution's family aliases with them,
// and Latin text would start coming from IPAGothic.
const useBundledFonts = (): void => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fontconfig-'))
  const configPath = path.join(cacheDir, 'fonts.conf')

  const rejected = SHADOWING_CJK_FONTS.map(
    (family) =>
      `    <rejectfont><pattern><patelt name="family"><string>${family}</string></patelt></pattern></rejectfont>`
  ).join('\n')

  fs.writeFileSync(
    configPath,
    `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <dir>${fontsDir}</dir>
  <cachedir>${cacheDir}</cachedir>
  <selectfont>
${rejected}
  </selectfont>
</fontconfig>
`,
    'utf8'
  )

  process.env.FONTCONFIG_FILE = configPath
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
        res.writeHead(200, { 'Content-Type': contentType(filePath) })
        res.end(body)
      })
    })

    server.listen(0, '127.0.0.1', () => {
      const address: any = server.address()
      resolve({ port: address.port, close: () => server.close() })
    })
  })

// This argument shoots the landing page rather than a deck: a separate
// invocation, because dist/index.html is written in the last stage, long
// after the decks have been shot. It is `.` and not `--index` because pnpm
// eats leading-dash arguments on their way to a script — the same trap that
// once sent every deck's build output into the root of dist/.
const INDEX = '.'

const shoot = async (page: Page, port: number, slug: string): Promise<void> => {
  const index = slug === INDEX

  await page.goto(`http://127.0.0.1:${port}/${index ? '' : `${slug}/`}`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  })

  // The decks render client side, so an empty #root means the slide has not
  // been painted yet and the screenshot would come out blank. The landing
  // page is plain HTML written by the build; it has no #root to wait on.
  if (!index) {
    await page.waitForFunction(
      () => {
        const root = document.getElementById('root')
        return !!root && root.childElementCount > 0
      },
      { timeout: 30000 }
    )
  }

  await page.screenshot({
    path: path.join(distDir, `${index ? 'index' : slug}.png`),
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
  })
}

const main = async () => {
  const slugs = process.argv.slice(2)
  if (!slugs.length) {
    console.log(`usage: ./generate-screenshot [slug... | ${INDEX}]`)
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
        console.log(`[screenshot] ${slug === INDEX ? 'index' : slug}.png`)
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
