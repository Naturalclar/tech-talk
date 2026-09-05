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

// Content past the edge of the slide it is on. Nothing scrolls a slide, so
// that content cannot be reached — which is the whole reason
// src/deck/fit-to-slide.ts exists. This is the check that it is still working:
// seventeen slides were in that state before it, and if it ever stops running
// they go back to it silently, with a build that passes and decks that lose
// their bottom third.
//
// The measurement is only possible because every slide is already in the tree.
// remdx hides the ones it is not showing with `display: none`, so they measure
// zero; revealing them all and then appending and removing one node inside
// #root fires the fitter's own MutationObserver over the lot. That costs about
// 90ms for a fifty-slide deck against 300ms *per slide* for navigating to each
// one, which was the first thing tried and is too slow to run on every build.
//
// It is deliberately not a check on how far a slide had to be scaled. Every
// one that needs scaling gets it, and a floor on the ratio would be a guess
// about legibility rather than a defect — the worst today is 0.727 and is
// perfectly readable.
const findOverflow = async (page: Page): Promise<string[]> =>
  page.evaluate(() => {
    const slides = [
      ...document.querySelectorAll<HTMLElement>('#root > div > div > div'),
    ]
    if (!slides.length) {
      return ['no slides found — the tree fit-to-slide.ts walks has changed']
    }

    const saved = slides.map((slide) => slide.getAttribute('style'))
    for (const slide of slides) {
      slide.style.display = 'block'
      slide.style.opacity = '1'
      slide.style.visibility = 'visible'
    }

    const root = document.getElementById('root')!
    const poke = document.createElement('span')
    root.append(poke)
    poke.remove()

    return new Promise<string[]>((resolve) => {
      // One frame for the fitter's own requestAnimationFrame, one to let what
      // it wrote take effect.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const over: string[] = []

          slides.forEach((slide, index) => {
            const box = slide.getBoundingClientRect()
            // The same two exclusions the fitter makes when it measures: a
            // watermark is out of the flow, and what is inside a box that
            // scrolls is reachable rather than lost.
            const walk = (parent: Element): void => {
              for (const child of parent.children) {
                const style = getComputedStyle(child)
                if (
                  style.position === 'absolute' ||
                  style.position === 'fixed'
                ) {
                  continue
                }
                const rect = child.getBoundingClientRect()
                if (!rect.width && !rect.height) {
                  continue
                }
                // Two pixels of tolerance: a scale lands on a fraction of a
                // pixel, and rounding is not something an audience can see.
                const below = Math.round(rect.bottom - box.bottom)
                const past = Math.round(rect.right - box.right)
                if (below > 2 || past > 2) {
                  const how = [
                    below > 2 ? `${below}px below the bottom` : '',
                    past > 2 ? `${past}px past the right edge` : '',
                  ]
                    .filter(Boolean)
                    .join(' and ')
                  over.push(
                    `slide ${index}: <${child.tagName.toLowerCase()}> ${how}`
                  )
                  return
                }
                if (!/auto|scroll/.test(style.overflowX + style.overflowY)) {
                  walk(child)
                }
              }
            }
            walk(slide)
          })

          slides.forEach((slide, index) => {
            const style = saved[index]
            if (style === null) {
              slide.removeAttribute('style')
            } else {
              slide.setAttribute('style', style)
            }
          })

          resolve(over)
        })
      )
    })
  })

const shoot = async (page: Page, port: number, slug: string): Promise<void> => {
  const index = slug === INDEX

  // A deck that names a component nothing defines compiles cleanly and then
  // throws while rendering, leaving #root empty. That used to surface as the
  // wait below timing out thirty seconds later with nothing to say; catching
  // the error itself fails at once and names it.
  // It has to be a promise rather than a flag checked afterwards: the deck
  // never paints, so the wait below would spend its full thirty seconds first
  // and report the timeout instead of the error that caused it. Raced against
  // the wait, whichever happens first is what gets reported.
  let onError = (_: Error) => {}
  const threw = new Promise<never>((_, reject) => {
    onError = (error: Error) => reject(new Error(error.message.split('\n')[0]))
  })
  page.on('pageerror', onError)
  // Nothing awaits this promise unless the race below does, and an unobserved
  // rejection would take the process down with it.
  threw.catch(() => {})

  try {
    await page.goto(`http://127.0.0.1:${port}/${index ? '' : `${slug}/`}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    // The decks render client side, so an empty #root means the slide has not
    // been painted yet and the screenshot would come out blank. The landing
    // page is plain HTML written by the build; it has no #root to wait on.
    if (!index) {
      await Promise.race([
        page.waitForFunction(
          () => {
            const root = document.getElementById('root')
            return !!root && root.childElementCount > 0
          },
          { timeout: 30000 }
        ),
        threw,
      ])
    }

    // An image the deck points at but the site does not have. The build had
    // no opinion about this before: vite does not resolve these paths — they
    // are plain strings in the markup — and the screenshot succeeded, so a
    // deck could go out with the broken-image icon baked into its own
    // og:image. remdx draws every slide into the DOM at once, so this covers
    // the whole deck rather than the slide being photographed.
    //
    // Decks only. The landing page's thumbnails for talks hosted elsewhere
    // come from other people's servers, and the rule there is that every
    // failure ends in a card and never a failed deploy — og-image.ts already
    // checks those addresses load and falls back to a placeholder when they
    // do not.
    if (!index) {
      const broken = await page.evaluate(() =>
        [...document.images]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.getAttribute('src'))
      )
      if (broken.length) {
        throw new Error(`broken image(s): ${[...new Set(broken)].join(', ')}`)
      }
    }

    // The landing page's thumbnails are `loading="lazy"`, and a lazy image
    // starts loading from layout rather than from parsing — after the point
    // `networkidle` calls the page settled. Which of the ones near the fold
    // had arrived when the shutter came down therefore varied per run, and
    // dist/index.png came out a different size on every build: 71533, 71518
    // and 71460 bytes over three. That is the reproducibility bounding the
    // deck builds bought back, lost again in the last stage.
    //
    await page.screenshot({
      path: path.join(distDir, `${index ? 'index' : slug}.png`),
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    })

    // After the screenshot, because it reveals every slide at once and the
    // photograph wants the deck as a presenter sees it. Decks only: the
    // landing page has no slides, and its own overflow is a different
    // question that the responsive layout already answers.
    if (!index) {
      const over = await findOverflow(page)
      if (over.length) {
        throw new Error(
          `content past the edge of the slide:\n  ${over.join('\n  ')}`
        )
      }
    }
  } finally {
    page.off('pageerror', onError)
  }
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
